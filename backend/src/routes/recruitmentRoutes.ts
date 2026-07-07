import { Router } from 'express';
import {
  getJobs,
  createJob,
  getCandidates,
  getCandidateById,
  applyJob,
  updateCandidateStage,
  getInterviews,
  createInterview,
  updateInterviewStatus,
  getInterviewFeedback,
  createInterviewFeedback,
  getCandidateDocuments,
  uploadCandidateDocument
} from '../controllers/recruitmentController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

type EmployeeRole = 'Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern';

const router = Router();

const hrAdmins: EmployeeRole[] = ['Super Admin', 'Admin', 'HR'];
const interviewers: EmployeeRole[] = ['Super Admin', 'Admin', 'HR', 'Manager', 'Employee'];

// Jobs Endpoints
router.get('/jobs', authenticateToken as any, getJobs as any);
router.post('/jobs', authenticateToken as any, requireRole(hrAdmins) as any, createJob as any);

// Candidates Endpoints
router.get('/candidates', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, getCandidates as any);
router.get('/candidates/:id', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, getCandidateById as any);
router.post('/candidates', upload.single('resume'), applyJob as any); // Public Endpoint for Applicant Resume Submission
router.post('/candidates/:id/stage', authenticateToken as any, requireRole(hrAdmins) as any, updateCandidateStage as any);

// Candidate Documents
router.get('/candidates/:id/documents', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, getCandidateDocuments as any);
router.post('/candidates/:id/documents', authenticateToken as any, requireRole(hrAdmins) as any, upload.single('document'), uploadCandidateDocument as any);

// Interviews Endpoints
router.get('/interviews', authenticateToken as any, getInterviews as any);
router.post('/interviews', authenticateToken as any, requireRole(hrAdmins) as any, createInterview as any);
router.put('/interviews/:id', authenticateToken as any, requireRole(interviewers) as any, updateInterviewStatus as any);
router.get('/interviews/:id/feedback', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, getInterviewFeedback as any);
router.post('/interviews/:id/feedback', authenticateToken as any, requireRole(interviewers) as any, createInterviewFeedback as any);

export default router;
