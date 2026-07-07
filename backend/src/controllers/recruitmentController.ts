import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { uploadToCloudinary } from '../config/cloudinary';
import { Candidate, Job, Interview, InterviewFeedback, CandidateDocument } from '../types';

// Helper to get actor name for audit logs
async function getActorName(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) return 'System';
  const emp = await db.getEmployeeById(req.user.id);
  return emp ? `${emp.first_name} ${emp.last_name}` : req.user.email;
}

export async function getJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const jobs = await db.getJobs();
    res.json(jobs);
  } catch (err) {
    console.error('getJobs error:', err);
    res.status(500).json({ message: 'Error fetching jobs.' });
  }
}

export async function createJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { title, department_id, description, requirements, status } = req.body;
  if (!title || !description) {
    res.status(400).json({ message: 'Title and description are required.' });
    return;
  }
  try {
    const job = await db.createJob(
      title,
      department_id ? parseInt(department_id) : null,
      description,
      requirements,
      status || 'Draft'
    );
    res.status(201).json(job);
  } catch (err) {
    console.error('createJob error:', err);
    res.status(500).json({ message: 'Error creating job.' });
  }
}

export async function getCandidates(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const jobId = req.query.job_id ? parseInt(req.query.job_id as string) : undefined;
    const candidates = await db.getCandidates(jobId);
    res.json(candidates);
  } catch (err) {
    console.error('getCandidates error:', err);
    res.status(500).json({ message: 'Error fetching candidates.' });
  }
}

export async function getCandidateById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid candidate ID.' });
      return;
    }
    const candidate = await db.getCandidateById(id);
    if (!candidate) {
      res.status(404).json({ message: 'Candidate not found.' });
      return;
    }
    res.json(candidate);
  } catch (err) {
    console.error('getCandidateById error:', err);
    res.status(500).json({ message: 'Error fetching candidate details.' });
  }
}

export async function applyJob(req: any, res: Response): Promise<void> {
  try {
    const { job_id, first_name, last_name, email, phone, notes } = req.body;
    if (!first_name || !last_name || !email) {
      res.status(400).json({ message: 'First name, last name, and email are required.' });
      return;
    }

    let resumeUrl = '';
    if (req.file) {
      const cloudRes = await uploadToCloudinary(req.file.path, 'resumes');
      await db.saveCloudinaryMapping(req.file.filename, cloudRes.secure_url, cloudRes.public_id);
      resumeUrl = cloudRes.secure_url;
    } else {
      res.status(400).json({ message: 'Resume file is required.' });
      return;
    }

    const candidate = await db.createCandidate(
      job_id ? parseInt(job_id) : null,
      first_name,
      last_name,
      email,
      phone || null,
      resumeUrl,
      notes || null
    );

    // Save as document too
    await db.createCandidateDocument(candidate.id, req.file.originalname, resumeUrl, req.file.mimetype);

    // Create system notification for HR
    const hrAdmins = (await db.getEmployees()).filter(e => ['Super Admin', 'Admin', 'HR'].includes(e.role));
    for (const hr of hrAdmins) {
      await db.createNotification(
        hr.id,
        'New Candidate Application',
        `A new application has been submitted by ${first_name} ${last_name} for Job #${job_id || 'General'}.`,
        'SYSTEM'
      );
    }

    res.status(201).json(candidate);
  } catch (err) {
    console.error('applyJob error:', err);
    res.status(500).json({ message: 'Error submitting candidate application.' });
  }
}

export async function updateCandidateStage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    const { stage } = req.body;
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid candidate ID.' });
      return;
    }
    if (!stage) {
      res.status(400).json({ message: 'Stage is required.' });
      return;
    }

    const currentCandidate = await db.getCandidateById(id);
    if (!currentCandidate) {
      res.status(404).json({ message: 'Candidate not found.' });
      return;
    }

    const updated = await db.updateCandidateStage(id, stage);
    if (!updated) {
      res.status(500).json({ message: 'Error updating candidate stage.' });
      return;
    }

    // --- CONVERSION HOOK: Candidate joined, convert to Employee ---
    if (stage === 'Joined' && currentCandidate.stage !== 'Joined') {
      // Check duplicate email
      const existingEmp = await db.getEmployeeByEmail(currentCandidate.email);
      if (!existingEmp) {
        // Generate a new employee code (like EMP-015)
        const emps = await db.getEmployees();
        const nextEmpNum = emps.length + 1;
        const employeeId = `EMP-${String(nextEmpNum).padStart(3, '0')}`;

        // Get job details to set default designation
        let designation = 'Software Engineer';
        let departmentId = null;
        if (currentCandidate.job_id) {
          const jobs = await db.getJobs();
          const job = jobs.find(j => j.id === currentCandidate.job_id);
          if (job) {
            designation = job.title;
            departmentId = job.department_id;
          }
        }

        const defaultPassword = 'Welcome@123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Create employee
        const newEmp = await db.createEmployee({
          employee_id: employeeId,
          first_name: currentCandidate.first_name,
          last_name: currentCandidate.last_name,
          email: currentCandidate.email,
          password: hashedPassword,
          phone: currentCandidate.phone || undefined,
          department_id: departmentId,
          designation: designation,
          status: 'Active',
          joining_date: new Date().toISOString().split('T')[0],
          role: 'Employee'
        });

        // Initialize onboarding tasks
        const obTasks = await db.getOnboardingTasks();
        for (const task of obTasks) {
          await db.updateOnboardingProgress(newEmp.id, task.id, 'Pending');
        }

        // Initialize default payroll allocation
        // Assign default salary structure (id: 1)
        const effectiveDate = new Date().toISOString().split('T')[0];
        await db.assignEmployeeSalary(newEmp.id, 1, 'Default Bank', '0000000000', 'TAX-PENDING', effectiveDate);

        // Audit Log
        const actorName = await getActorName(req);
        await db.logActivity(
          newEmp.id,
          'EMPLOYEE_CREATED',
          `Employee account auto-created from recruitment stage transition for ${currentCandidate.first_name} ${currentCandidate.last_name} by ${actorName}.`
        );

        // Notify new employee
        await db.createNotification(
          newEmp.id,
          'Welcome to the Workforce!',
          `Welcome ${currentCandidate.first_name}! Your account has been setup. Initial onboarding is pending.`,
          'SYSTEM'
        );

        // Notify HR
        const hrAdmins = emps.filter(e => ['Super Admin', 'Admin', 'HR'].includes(e.role));
        for (const hr of hrAdmins) {
          await db.createNotification(
            hr.id,
            'Candidate Hired & Converted',
            `Candidate ${currentCandidate.first_name} ${currentCandidate.last_name} has been hired and converted to employee ${employeeId}.`,
            'SYSTEM'
          );
        }
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('updateCandidateStage error:', err);
    res.status(500).json({ message: 'Error updating candidate stage.' });
  }
}

export async function getInterviews(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const candidateId = req.query.candidate_id ? parseInt(req.query.candidate_id as string) : undefined;
    const interviews = await db.getInterviews(candidateId);
    res.json(interviews);
  } catch (err) {
    console.error('getInterviews error:', err);
    res.status(500).json({ message: 'Error fetching interviews.' });
  }
}

export async function createInterview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { candidate_id, interviewer_id, schedule_time, stage } = req.body;
    if (!candidate_id || !schedule_time || !stage) {
      res.status(400).json({ message: 'Candidate ID, schedule time, and stage are required.' });
      return;
    }
    const interview = await db.createInterview(
      parseInt(candidate_id as string),
      interviewer_id ? parseInt(interviewer_id as string) : null,
      schedule_time,
      stage
    );

    // Create system notification for candidate and interviewer
    if (interviewer_id) {
      const interviewer = await db.getEmployeeById(parseInt(interviewer_id as string));
      const cand = await db.getCandidateById(parseInt(candidate_id as string));
      if (interviewer && cand) {
        await db.createNotification(
          interviewer.id,
          'New Interview Scheduled',
          `You have been scheduled to interview candidate ${cand.first_name} ${cand.last_name} on ${new Date(schedule_time).toLocaleString()}.`,
          'SYSTEM'
        );
      }
    }

    res.status(201).json(interview);
  } catch (err) {
    console.error('createInterview error:', err);
    res.status(500).json({ message: 'Error scheduling interview.' });
  }
}

export async function updateInterviewStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid interview ID.' });
      return;
    }
    if (!status) {
      res.status(400).json({ message: 'Status is required.' });
      return;
    }
    await db.updateInterviewStatus(id, status);
    res.json({ success: true });
  } catch (err) {
    console.error('updateInterviewStatus error:', err);
    res.status(500).json({ message: 'Error updating interview status.' });
  }
}

export async function getInterviewFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const interviewId = parseInt(req.params.id as string);
    if (isNaN(interviewId)) {
      res.status(400).json({ message: 'Invalid interview ID.' });
      return;
    }
    const feedback = await db.getInterviewFeedback(interviewId);
    res.json(feedback);
  } catch (err) {
    console.error('getInterviewFeedback error:', err);
    res.status(500).json({ message: 'Error fetching interview feedback.' });
  }
}

export async function createInterviewFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const interviewId = parseInt(req.params.id as string);
    const { feedback_text, score } = req.body;
    if (isNaN(interviewId)) {
      res.status(400).json({ message: 'Invalid interview ID.' });
      return;
    }
    if (!feedback_text || score === undefined) {
      res.status(400).json({ message: 'Feedback text and score are required.' });
      return;
    }
    const interviewerId = req.user ? req.user.id : null;
    const feedback = await db.createInterviewFeedback(
      interviewId,
      interviewerId,
      feedback_text,
      parseInt(score)
    );
    res.status(201).json(feedback);
  } catch (err) {
    console.error('createInterviewFeedback error:', err);
    res.status(500).json({ message: 'Error submitting interview feedback.' });
  }
}

export async function getCandidateDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const candidateId = parseInt(req.params.id as string);
    if (isNaN(candidateId)) {
      res.status(400).json({ message: 'Invalid candidate ID.' });
      return;
    }
    const docs = await db.getCandidateDocuments(candidateId);
    res.json(docs);
  } catch (err) {
    console.error('getCandidateDocuments error:', err);
    res.status(500).json({ message: 'Error fetching candidate documents.' });
  }
}

export async function uploadCandidateDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const candidateId = parseInt(req.params.id as string);
    if (isNaN(candidateId)) {
      res.status(400).json({ message: 'Invalid candidate ID.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }

    const cloudRes = await uploadToCloudinary(req.file.path, 'documents');
    await db.saveCloudinaryMapping(req.file.filename, cloudRes.secure_url, cloudRes.public_id);

    const doc = await db.createCandidateDocument(
      candidateId,
      req.file.originalname,
      cloudRes.secure_url,
      req.file.mimetype
    );

    res.status(201).json(doc);
  } catch (err) {
    console.error('uploadCandidateDocument error:', err);
    res.status(500).json({ message: 'Error uploading document.' });
  }
}
