import { Router } from 'express';
import {
  getSalaryStructures,
  createSalaryStructure,
  getEmployeeSalary,
  assignEmployeeSalary
} from '../controllers/payrollController';
import { authenticateToken, requireRole } from '../middleware/auth';

type EmployeeRole = 'Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern';

const router = Router();

const hrAdmins: EmployeeRole[] = ['Super Admin', 'Admin', 'HR'];

// Salary Structures Catalog
router.get('/structures', authenticateToken as any, requireRole(hrAdmins) as any, getSalaryStructures as any);
router.post('/structures', authenticateToken as any, requireRole(hrAdmins) as any, createSalaryStructure as any);

// Employee Salary Details
router.get('/employee/:employeeId', authenticateToken as any, getEmployeeSalary as any);
router.post('/employee/assign', authenticateToken as any, requireRole(hrAdmins) as any, assignEmployeeSalary as any);

export default router;
