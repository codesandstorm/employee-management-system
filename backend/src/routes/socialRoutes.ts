import { Router } from 'express';
import {
  getPosts,
  createPost,
  getComments,
  createComment,
  reactPost,
  pinPost,
  votePoll
} from '../controllers/socialController';
import { authenticateToken, requireRole } from '../middleware/auth';

type EmployeeRole = 'Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern';

const router = Router();

// Feed posts
router.get('/posts', authenticateToken as any, getPosts as any);
router.post('/posts', authenticateToken as any, createPost as any);

// Comments
router.get('/posts/:id/comments', authenticateToken as any, getComments as any);
router.post('/posts/:id/comment', authenticateToken as any, createComment as any);

// Reactions and Pins
router.post('/posts/:id/react', authenticateToken as any, reactPost as any);
router.post('/posts/:id/pin', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, pinPost as any);

// Interactive Poll Voting
router.post('/polls/:id/vote', authenticateToken as any, votePoll as any);

export default router;
