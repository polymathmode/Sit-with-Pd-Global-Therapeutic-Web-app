import { Router } from 'express';
import { getDashboard, getProgramContent } from '../controllers/dashboard.controller';
import { getDashboardStats, getAllUsers, getUserById, getCalEventTypes } from '../controllers/admin.controller';
import {
  adminListBlogPosts,
  getBlogPostByIdAdmin,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from '../controllers/blog.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { uploadImage } from '../middleware/upload.middleware';

// ── User Dashboard ────────────────────────────────────────────────────────────
export const dashboardRouter = Router();

dashboardRouter.get('/', authenticate, getDashboard);
dashboardRouter.get('/programs/:programId', authenticate, getProgramContent);

// ── Admin Routes ──────────────────────────────────────────────────────────────
export const adminRouter = Router();

adminRouter.get('/stats', authenticate, adminOnly, getDashboardStats);
adminRouter.get('/users', authenticate, adminOnly, getAllUsers);
adminRouter.get('/users/:id', authenticate, adminOnly, getUserById);
adminRouter.get('/cal/event-types', authenticate, adminOnly, getCalEventTypes);

// Blog (drafts + CRUD — public reads are on /api/blog)
adminRouter.get('/blog', authenticate, adminOnly, adminListBlogPosts);
adminRouter.get('/blog/:id', authenticate, adminOnly, getBlogPostByIdAdmin);
adminRouter.post(
  '/blog',
  authenticate,
  adminOnly,
  uploadImage.single('coverImage'),
  createBlogPost
);
adminRouter.patch(
  '/blog/:id',
  authenticate,
  adminOnly,
  uploadImage.single('coverImage'),
  updateBlogPost
);
adminRouter.delete('/blog/:id', authenticate, adminOnly, deleteBlogPost);
