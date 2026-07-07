import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { Post } from '../types';

export async function getPosts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    const posts = await db.getPosts(req.user.id);
    res.json(posts);
  } catch (err) {
    console.error('getPosts error:', err);
    res.status(500).json({ message: 'Error retrieving posts feed.' });
  }
}

export async function createPost(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const { content, type, attachments, poll } = req.body;
    if (!content) {
      res.status(400).json({ message: 'Content is required.' });
      return;
    }

    const post = await db.createPost(
      req.user.id,
      content,
      type || 'General',
      attachments || []
    );

    // If it has poll options, create poll linked to this post
    let createdPoll = null;
    if (poll && poll.question && Array.isArray(poll.options) && poll.options.length > 0) {
      createdPoll = await db.createPoll(post.id, poll.question, poll.options);
    }

    res.status(201).json({
      ...post,
      poll: createdPoll ? { ...createdPoll, votes: {}, user_vote: null } : null,
      comments_count: 0,
      reactions: {},
      user_reaction: null
    });
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ message: 'Error creating social feed post.' });
  }
}

export async function createComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const postId = parseInt(req.params.id as string);
    const { content } = req.body;

    if (isNaN(postId)) {
      res.status(400).json({ message: 'Invalid post ID.' });
      return;
    }

    if (!content) {
      res.status(400).json({ message: 'Comment content cannot be empty.' });
      return;
    }

    const comment = await db.createComment(postId, req.user.id, content);
    
    // Populate comment author name
    const author = await db.getEmployeeById(req.user.id);
    const populatedComment = {
      ...comment,
      employee_name: author ? `${author.first_name} ${author.last_name}` : 'Unknown'
    };

    res.status(201).json(populatedComment);
  } catch (err) {
    console.error('createComment error:', err);
    res.status(500).json({ message: 'Error submitting comment.' });
  }
}

export async function reactPost(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const postId = parseInt(req.params.id as string);
    const { reaction_type } = req.body; // Can be string (e.g. 'Like', 'Celebrate') or null to remove

    if (isNaN(postId)) {
      res.status(400).json({ message: 'Invalid post ID.' });
      return;
    }

    await db.reactPost(postId, req.user.id, reaction_type || null);
    res.json({ success: true });
  } catch (err) {
    console.error('reactPost error:', err);
    res.status(500).json({ message: 'Error updating reaction.' });
  }
}

export async function votePoll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const pollId = parseInt(req.params.id as string);
    const { option_index } = req.body;

    if (isNaN(pollId) || option_index === undefined) {
      res.status(400).json({ message: 'Invalid poll ID or option index.' });
      return;
    }

    await db.votePoll(pollId, req.user.id, parseInt(option_index));
    res.json({ success: true });
  } catch (err) {
    console.error('votePoll error:', err);
    res.status(500).json({ message: 'Error casting poll vote.' });
  }
}

export async function pinPost(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const postId = parseInt(req.params.id as string);
    const { is_pinned } = req.body;

    if (isNaN(postId) || is_pinned === undefined) {
      res.status(400).json({ message: 'Invalid post ID or pin status.' });
      return;
    }

    // Role verification: Admins, HR or Managers
    const canPin = ['Super Admin', 'Admin', 'HR', 'Manager'].includes(req.user.role);
    if (!canPin) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to pin posts.' });
      return;
    }

    await db.pinPost(postId, !!is_pinned);
    res.json({ success: true });
  } catch (err) {
    console.error('pinPost error:', err);
    res.status(500).json({ message: 'Error updating pin status.' });
  }
}

export async function getComments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const postId = parseInt(req.params.id as string);
    if (isNaN(postId)) {
      res.status(400).json({ message: 'Invalid post ID.' });
      return;
    }

    const comments = await db.getComments(postId);
    res.json(comments);
  } catch (err) {
    console.error('getComments error:', err);
    res.status(500).json({ message: 'Error retrieving comments.' });
  }
}
