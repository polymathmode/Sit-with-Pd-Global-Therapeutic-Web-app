import { Router } from 'express';
import { getDashboard, getProgramContent } from '../controllers/dashboard.controller';
import { getDashboardStats, getAllUsers, getUserById } from '../controllers/admin.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';

// ── User Dashboard ────────────────────────────────────────────────────────────
export const dashboardRouter = Router();

dashboardRouter.get('/', authenticate, getDashboard);
dashboardRouter.get('/programs/:programId', authenticate, getProgramContent);

// ── Admin Routes ──────────────────────────────────────────────────────────────
export const adminRouter = Router();

adminRouter.get('/stats', authenticate, adminOnly, getDashboardStats);
adminRouter.get('/users', authenticate, adminOnly, getAllUsers);
adminRouter.get('/users/:id', authenticate, adminOnly, getUserById);
