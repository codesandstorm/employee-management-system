import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getSalaryStructures(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const structures = await db.getSalaryStructures();
    res.json(structures);
  } catch (err) {
    console.error('getSalaryStructures error:', err);
    res.status(500).json({ message: 'Error fetching salary structures.' });
  }
}

export async function createSalaryStructure(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, base_salary, allowances, deductions } = req.body;
    if (!name || base_salary === undefined) {
      res.status(400).json({ message: 'Structure name and base salary are required.' });
      return;
    }

    const structure = await db.createSalaryStructure(
      name,
      parseFloat(base_salary),
      allowances || {},
      deductions || {}
    );

    res.status(201).json(structure);
  } catch (err) {
    console.error('createSalaryStructure error:', err);
    res.status(500).json({ message: 'Error creating salary structure.' });
  }
}

export async function getEmployeeSalary(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    // Access control: HR, Admin, or self
    const isSelf = req.user.id === employeeId;
    const isHRAdmin = ['Super Admin', 'Admin', 'HR'].includes(req.user.role);

    if (!isSelf && !isHRAdmin) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to view this salary structure.' });
      return;
    }

    const salary = await db.getEmployeeSalary(employeeId);
    if (!salary) {
      res.status(404).json({ message: 'Salary configuration not found for this employee.' });
      return;
    }

    res.json(salary);
  } catch (err) {
    console.error('getEmployeeSalary error:', err);
    res.status(500).json({ message: 'Error retrieving employee salary settings.' });
  }
}

export async function assignEmployeeSalary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employee_id, structure_id, bank_name, account_number, tax_identifier, effective_date } = req.body;
    if (!employee_id || !structure_id || !effective_date) {
      res.status(400).json({ message: 'Employee ID, structure ID, and effective date are required.' });
      return;
    }

    const assigned = await db.assignEmployeeSalary(
      parseInt(employee_id),
      parseInt(structure_id),
      bank_name || null,
      account_number || null,
      tax_identifier || null,
      effective_date
    );

    // Create system notification for employee
    if (req.user) {
      await db.createNotification(
        parseInt(employee_id),
        'Salary Structure Assigned/Updated',
        `A new salary structure configuration effective from ${effective_date} has been allocated to your profile.`,
        'SYSTEM'
      );
    }

    res.json(assigned);
  } catch (err) {
    console.error('assignEmployeeSalary error:', err);
    res.status(500).json({ message: 'Error assigning salary structure to employee.' });
  }
}
