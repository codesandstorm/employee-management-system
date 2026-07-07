import { Router } from 'express';
import {
  getEmployeeOnboarding,
  getOnboardingTasks,
  createOnboardingTask,
  updateProgressStatus
} from '../controllers/onboardingController';
import { authenticateToken, requireRole } from '../middleware/auth';

type EmployeeRole = 'Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern';

const router = Router();

const hrAdmins: EmployeeRole[] = ['Super Admin', 'Admin', 'HR'];

// Onboarding Tasks Templates
router.get('/tasks', authenticateToken as any, getOnboardingTasks as any);
router.post('/tasks', authenticateToken as any, requireRole(hrAdmins) as any, createOnboardingTask as any);

// Onboarding Progress check/update
router.get('/:employeeId', authenticateToken as any, getEmployeeOnboarding as any);
router.post('/progress/complete', authenticateToken as any, updateProgressStatus as any);

export default router;
