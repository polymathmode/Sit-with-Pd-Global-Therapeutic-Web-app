import { Router } from 'express';
import {
  // Program
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  adminGetAllPrograms,
  // Weeks
  getWeeks,
  addWeek,
  updateWeek,
  deleteWeek,
  // Modules
  addModule,
  updateModule,
  deleteModule,
} from '../controllers/program.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { uploadImage } from '../middleware/upload.middleware';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
// Programs listing page (table: Name, Type, Enrolled, Price, Status)
router.get('/', getAllPrograms);
// Program detail/content page (full week → module tree)
router.get('/:id', getProgramById);

// ── Admin: Programs ───────────────────────────────────────────────────────────
// Must be declared before /:id to avoid "admin" being matched as an :id param
router.get('/admin/all', authenticate, adminOnly, adminGetAllPrograms);

// Create Program — accepts optional nested `weeks` JSON for single-shot creation
router.post(
  '/',
  authenticate,
  adminOnly,
  uploadImage.single('thumbnail'),
  createProgram
);

// Edit Program (Basic Info, Learning Objectives, Facilitator, toggle isPublished)
router.patch(
  '/:id',
  authenticate,
  adminOnly,
  uploadImage.single('thumbnail'),
  updateProgram
);

// Delete Program (cascades to weeks + modules via Prisma onDelete: Cascade)
router.delete('/:id', authenticate, adminOnly, deleteProgram);

// ── Admin: Weeks ──────────────────────────────────────────────────────────────
// GET   /api/programs/:id/weeks              — load all weeks (with modules) for a program
// POST  /api/programs/:id/weeks              — "Add Week" modal → create a week
// PATCH /api/programs/:id/weeks/:weekId      — edit a week's title/description/objectives
// DELETE /api/programs/:id/weeks/:weekId     — trash icon on week card

router.get('/:id/weeks', authenticate, adminOnly, getWeeks);
router.post('/:id/weeks', authenticate, adminOnly, addWeek);
router.patch('/:id/weeks/:weekId', authenticate, adminOnly, updateWeek);
router.delete('/:id/weeks/:weekId', authenticate, adminOnly, deleteWeek);

// ── Admin: Modules ────────────────────────────────────────────────────────────
// POST   /api/programs/:id/weeks/:weekId/modules                          — "Add Module" modal
// PATCH  /api/programs/:id/weeks/:weekId/modules/:moduleId                — edit a module
// DELETE /api/programs/:id/weeks/:weekId/modules/:moduleId                — X icon on module card
//
// No file uploads — modules use contentUrl (YouTube/Vimeo/Google Docs) or embedCode (iframe).

router.post('/:id/weeks/:weekId/modules', authenticate, adminOnly, addModule);
router.patch('/:id/weeks/:weekId/modules/:moduleId', authenticate, adminOnly, updateModule);
router.delete('/:id/weeks/:weekId/modules/:moduleId', authenticate, adminOnly, deleteModule);

export default router;