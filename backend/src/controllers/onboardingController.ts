import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { OnboardingTask, OnboardingProgress } from '../types';

export async function getEmployeeOnboarding(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employeeId = parseInt(req.params.employeeId as string);
    if (isNaN(employeeId)) {
      res.status(400).json({ message: 'Invalid employee ID.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    // Access control: HR, Admin, self, or manager
    const isSelf = req.user.id === employeeId;
    const isHRAdmin = ['Super Admin', 'Admin', 'HR'].includes(req.user.role);
    
    let isManagerOfEmployee = false;
    if (req.user.role === 'Manager') {
      const targetEmp = await db.getEmployeeById(employeeId);
      if (targetEmp && targetEmp.department_id) {
        const dept = await db.getDepartmentById(targetEmp.department_id);
        if (dept && dept.manager_id === req.user.id) {
          isManagerOfEmployee = true;
        }
      }
    }

    if (!isSelf && !isHRAdmin && !isManagerOfEmployee) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to view this onboarding checklist.' });
      return;
    }

    const progress = await db.getEmployeeOnboardingProgress(employeeId);
    res.json(progress);
  } catch (err) {
    console.error('getEmployeeOnboarding error:', err);
    res.status(500).json({ message: 'Error retrieving onboarding checklist.' });
  }
}

export async function getOnboardingTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const tasks = await db.getOnboardingTasks();
    res.json(tasks);
  } catch (err) {
    console.error('getOnboardingTasks error:', err);
    res.status(500).json({ message: 'Error fetching onboarding tasks.' });
  }
}

export async function createOnboardingTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, description, role_restriction, department_id, is_document_upload, is_asset_allocation, is_training_assignment } = req.body;
    if (!title) {
      res.status(400).json({ message: 'Task title is required.' });
      return;
    }

    const task = await db.createOnboardingTask(
      title,
      description || null,
      role_restriction || null,
      department_id ? parseInt(department_id) : null,
      !!is_document_upload,
      !!is_asset_allocation,
      !!is_training_assignment
    );

    // Auto assign new onboarding task to all existing active employees who are on probation
    const emps = await db.getEmployees();
    const probationEmps = emps.filter(e => e.status === 'Probation');
    for (const emp of probationEmps) {
      await db.updateOnboardingProgress(emp.id, task.id, 'Pending');
    }

    res.status(201).json(task);
  } catch (err) {
    console.error('createOnboardingTask error:', err);
    res.status(500).json({ message: 'Error creating onboarding task.' });
  }
}

export async function updateProgressStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employee_id, taskId, status, documentUrl, verifiedBy } = req.body;
    if (!employee_id || !taskId || !status) {
      res.status(400).json({ message: 'Employee ID, Task ID, and Status are required.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const targetEmpId = parseInt(employee_id);
    const targetTaskId = parseInt(taskId);

    // Access control: HR/Admin can edit anyone. Employee can self-submit (updates status to Completed/In Progress, uploads resume etc.)
    const isSelf = req.user.id === targetEmpId;
    const isHRAdmin = ['Super Admin', 'Admin', 'HR'].includes(req.user.role);

    if (!isSelf && !isHRAdmin) {
      res.status(403).json({ message: 'Forbidden: You cannot update this onboarding task.' });
      return;
    }

    // If an employee completes it, verifiedBy should be null (must be verified by HR). If HR completes it, verifiedBy is HR user ID.
    const finalVerifiedBy = isHRAdmin ? (verifiedBy ? parseInt(verifiedBy) : req.user.id) : null;
    
    await db.updateOnboardingProgress(
      targetEmpId,
      targetTaskId,
      status,
      documentUrl || null,
      finalVerifiedBy
    );

    // Create system notification for verification if completed by employee
    if (isSelf && status === 'Completed') {
      const hrAdmins = (await db.getEmployees()).filter(e => ['Super Admin', 'Admin', 'HR'].includes(e.role));
      for (const hr of hrAdmins) {
        await db.createNotification(
          hr.id,
          'Onboarding Task Submitted for Verification',
          `Employee ${req.user.email} has completed task #${targetTaskId} and requested verification.`,
          'SYSTEM'
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('updateProgressStatus error:', err);
    res.status(500).json({ message: 'Error updating onboarding progress status.' });
  }
}
