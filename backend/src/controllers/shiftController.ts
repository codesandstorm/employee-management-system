import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper to get actor name for audit logs
async function getActorName(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) return 'System';
  const emp = await db.getEmployeeById(req.user.id);
  return emp ? `${emp.first_name} ${emp.last_name}` : req.user.email;
}

export async function getShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const shifts = await db.getShifts();
    res.json(shifts);
  } catch (err) {
    console.error('getShifts error:', err);
    res.status(500).json({ message: 'Error retrieving shifts templates.' });
  }
}

export async function createShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, start_time, end_time, color } = req.body;
    if (!name || !start_time || !end_time) {
      res.status(400).json({ message: 'Shift Name, Start Time, and End Time are required.' });
      return;
    }

    const newShift = await db.createShift({
      name,
      start_time,
      end_time,
      color: color || '#1E2A4A'
    });

    const actorId = req.user?.id || null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      actorId,
      actorName,
      `Created shift template: ${name} (${start_time} - ${end_time})`,
      'ATTENDANCE',
      null,
      JSON.stringify(newShift)
    );

    res.status(201).json(newShift);
  } catch (err) {
    console.error('createShift error:', err);
    res.status(500).json({ message: 'Error creating shift template.' });
  }
}

export async function updateShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid shift ID.' });
      return;
    }

    const { name, start_time, end_time, color } = req.body;
    
    // Fetch previous state
    const shifts = await db.getShifts();
    const existing = shifts.find(s => s.id === id);
    if (!existing) {
      res.status(404).json({ message: 'Shift template not found.' });
      return;
    }

    const updated = await db.updateShift(id, { name, start_time, end_time, color });

    const actorId = req.user?.id || null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      actorId,
      actorName,
      `Updated shift template: ${name || existing.name}`,
      'ATTENDANCE',
      JSON.stringify(existing),
      JSON.stringify(updated)
    );

    res.json(updated);
  } catch (err) {
    console.error('updateShift error:', err);
    res.status(500).json({ message: 'Error updating shift template.' });
  }
}

export async function deleteShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid shift ID.' });
      return;
    }

    const shifts = await db.getShifts();
    const existing = shifts.find(s => s.id === id);
    if (!existing) {
      res.status(404).json({ message: 'Shift template not found.' });
      return;
    }

    const success = await db.deleteShift(id);
    if (!success) {
      res.status(400).json({ message: 'Could not delete shift template.' });
      return;
    }

    const actorId = req.user?.id || null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      actorId,
      actorName,
      `Deleted shift template: ${existing.name}`,
      'ATTENDANCE',
      JSON.stringify(existing),
      null
    );

    res.json({ message: 'Shift template deleted successfully.' });
  } catch (err) {
    console.error('deleteShift error:', err);
    res.status(500).json({ message: 'Error deleting shift template.' });
  }
}

export async function getEmployeeShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { startDate, endDate, employeeId } = req.query;
    const filters = {
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      employeeId: employeeId ? parseInt(String(employeeId)) : undefined
    };

    const roster = await db.getEmployeeShifts(filters);
    res.json(roster);
  } catch (err) {
    console.error('getEmployeeShifts error:', err);
    res.status(500).json({ message: 'Error retrieving shift rosters.' });
  }
}

export async function assignEmployeeShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employee_id, shift_id, date } = req.body;
    if (!employee_id || !shift_id || !date) {
      res.status(400).json({ message: 'employee_id, shift_id, and date are required.' });
      return;
    }

    const assigned = await db.assignEmployeeShift({
      employee_id: parseInt(employee_id),
      shift_id: parseInt(shift_id),
      date: String(date)
    });

    const shiftInfo = (await db.getShifts()).find(s => s.id === parseInt(shift_id));
    const empInfo = await db.getEmployeeById(parseInt(employee_id));

    // Log Activity
    const actorId = req.user?.id || null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      actorId,
      actorName,
      `Assigned shift "${shiftInfo?.name || shift_id}" to employee "${empInfo ? empInfo.first_name + ' ' + empInfo.last_name : employee_id}" for date ${date}`,
      'ATTENDANCE',
      null,
      JSON.stringify(assigned)
    );

    // Send notification to employee
    await db.createNotification(
      parseInt(employee_id),
      'Shift Schedule Updated',
      `You have been assigned the shift: "${shiftInfo?.name || 'Shift'}" (${shiftInfo?.start_time} - ${shiftInfo?.end_time}) on ${date}.`,
      'ATTENDANCE'
    );

    res.status(201).json(assigned);
  } catch (err) {
    console.error('assignEmployeeShift error:', err);
    res.status(500).json({ message: 'Error assigning shift roster.' });
  }
}

export async function requestShiftSwap(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeShiftId, targetEmployeeId, remarks } = req.body;
    if (!employeeShiftId || !targetEmployeeId) {
      res.status(400).json({ message: 'employeeShiftId and targetEmployeeId are required.' });
      return;
    }

    const swapTargetId = parseInt(targetEmployeeId);
    const shiftIdNum = parseInt(employeeShiftId);

    const roster = await db.getEmployeeShifts();
    const myShift = roster.find(es => es.id === shiftIdNum);
    if (!myShift) {
      res.status(404).json({ message: 'Roster shift not found.' });
      return;
    }

    if (myShift.employee_id !== req.user?.id) {
      res.status(403).json({ message: 'You can only request swaps for your own assigned shifts.' });
      return;
    }

    const updated = await db.requestShiftSwap(shiftIdNum, swapTargetId, remarks);

    // Notify target employee
    const requesterName = await getActorName(req);
    await db.createNotification(
      swapTargetId,
      'Shift Swap Request',
      `${requesterName} wants to swap shifts with you on ${myShift.date}. Remarks: ${remarks || 'None'}.`,
      'ATTENDANCE'
    );

    // Log activity
    const actorId = req.user?.id || null;
    await db.logAuditEvent(
      actorId,
      requesterName,
      `Requested shift swap for date ${myShift.date} with employee ID ${swapTargetId}`,
      'ATTENDANCE',
      JSON.stringify(myShift),
      JSON.stringify(updated)
    );

    res.json(updated);
  } catch (err) {
    console.error('requestShiftSwap error:', err);
    res.status(500).json({ message: 'Error submitting shift swap request.' });
  }
}

export async function processShiftSwap(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeShiftId, status } = req.body; // status: 'Approved' | 'Rejected'
    if (!employeeShiftId || !status || !['Approved', 'Rejected'].includes(status)) {
      res.status(400).json({ message: 'employeeShiftId and status ("Approved" or "Rejected") are required.' });
      return;
    }

    const shiftIdNum = parseInt(employeeShiftId);
    
    // Fetch requester shift details first
    const roster = await db.getEmployeeShifts();
    const reqShift = roster.find(es => es.id === shiftIdNum);
    if (!reqShift) {
      res.status(404).json({ message: 'Roster shift swap request not found.' });
      return;
    }

    if (reqShift.swap_status !== 'Pending') {
      res.status(400).json({ message: 'This shift swap request is not in Pending status.' });
      return;
    }

    // Verify swap permissions - can be processed by HR/Admin or the target employee who accepts it.
    const isTarget = reqShift.swap_target_employee_id === req.user?.id;
    const isApprover = ['Super Admin', 'Admin', 'HR', 'Manager'].includes(req.user?.role || '');

    if (!isTarget && !isApprover) {
      res.status(403).json({ message: 'You are not authorized to process this shift swap.' });
      return;
    }

    const success = await db.processShiftSwap(shiftIdNum, status);
    
    if (success) {
      const actorName = await getActorName(req);
      const requesterId = reqShift.employee_id;
      const targetId = reqShift.swap_target_employee_id;

      // Notify requester
      await db.createNotification(
        requesterId,
        `Shift Swap ${status}`,
        `Your shift swap request for ${reqShift.date} has been ${status.toLowerCase()} by ${actorName}.`,
        'ATTENDANCE'
      );

      // If approved, notify target as well
      if (status === 'Approved' && targetId) {
        await db.createNotification(
          targetId,
          'Shift Swap Approved',
          `The shift swap request on ${reqShift.date} has been finalized. Your roster has been updated.`,
          'ATTENDANCE'
        );
      }

      // Log Audit Event
      await db.logAuditEvent(
        req.user?.id || null,
        actorName,
        `Processed shift swap request ID ${shiftIdNum} with status ${status}`,
        'ATTENDANCE',
        JSON.stringify(reqShift),
        null
      );
    }

    res.json({ message: `Shift swap successfully ${status.toLowerCase()}.` });
  } catch (err) {
    console.error('processShiftSwap error:', err);
    res.status(500).json({ message: 'Error processing shift swap request.' });
  }
}
