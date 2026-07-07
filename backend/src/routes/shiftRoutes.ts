import { Router } from 'express';
import { 
  getShifts, 
  createShift, 
  updateShift, 
  deleteShift, 
  getEmployeeShifts, 
  assignEmployeeShift, 
  requestShiftSwap, 
  processShiftSwap 
} from '../controllers/shiftController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// Shift Template CRUD
router.get('/', authenticateToken as any, getShifts as any);
router.post('/', authenticateToken as any, requirePermission('manage_roster') as any, createShift as any);
router.put('/:id', authenticateToken as any, requirePermission('manage_roster') as any, updateShift as any);
router.delete('/:id', authenticateToken as any, requirePermission('manage_roster') as any, deleteShift as any);

// Roster assignments & Swaps
router.get('/employee', authenticateToken as any, getEmployeeShifts as any);
router.post('/assign', authenticateToken as any, requirePermission('manage_roster') as any, assignEmployeeShift as any);
router.post('/swap-request', authenticateToken as any, requestShiftSwap as any);
router.post('/swap-approve', authenticateToken as any, processShiftSwap as any);

export default router;
