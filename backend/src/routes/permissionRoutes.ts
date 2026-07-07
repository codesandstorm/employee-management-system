import { Router } from 'express';
import { getPermissions, getRolePermissions, assignRolePermissions } from '../controllers/permissionController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, getPermissions as any);
router.get('/role/:role', authenticateToken as any, getRolePermissions as any);
router.post('/assign', authenticateToken as any, requireRole(['Super Admin', 'Admin']) as any, assignRolePermissions as any);

export default router;
