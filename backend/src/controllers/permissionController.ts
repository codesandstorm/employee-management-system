import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper to get actor name for audit logs
async function getActorName(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) return 'System';
  const emp = await db.getEmployeeById(req.user.id);
  return emp ? `${emp.first_name} ${emp.last_name}` : req.user.email;
}

export async function getPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const permissions = await db.getPermissions();
    res.json(permissions);
  } catch (err) {
    console.error('getPermissions error:', err);
    res.status(500).json({ message: 'Error retrieving permissions.' });
  }
}

export async function getRolePermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { role } = req.params;
    if (!role) {
      res.status(400).json({ message: 'Role parameter is required.' });
      return;
    }
    const permissions = await db.getRolePermissions(role as string);
    res.json(permissions);
  } catch (err) {
    console.error('getRolePermissions error:', err);
    res.status(500).json({ message: 'Error retrieving permissions for role.' });
  }
}

export async function assignRolePermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { role, permissionIds } = req.body;
    if (!role || !Array.isArray(permissionIds)) {
      res.status(400).json({ message: 'Role name and permissionIds array are required.' });
      return;
    }

    if (role === 'Super Admin') {
      res.status(400).json({ message: 'Super Admin permissions cannot be modified.' });
      return;
    }

    const previousPerms = await db.getRolePermissions(role);
    await db.assignRolePermissions(role, permissionIds);

    // Write audit log
    const actorId = req.user?.id || null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      actorId,
      actorName,
      `Updated permissions for role: ${role}`,
      'SYSTEM',
      JSON.stringify(previousPerms),
      JSON.stringify(permissionIds)
    );

    res.json({ message: `Permissions for role '${role}' updated successfully.` });
  } catch (err) {
    console.error('assignRolePermissions error:', err);
    res.status(500).json({ message: 'Error updating role permissions.' });
  }
}
