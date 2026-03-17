import { Router } from 'express';
import {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  addLesson,
  updateLesson,
  deleteLesson,
  adminGetAllPrograms,
} from '../controllers/program.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { uploadImage, uploadLesson } from '../middleware/upload.middleware';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getAllPrograms);
router.get('/:id', getProgramById);

// ── Admin: Programs ───────────────────────────────────────────────────────────
router.get('/admin/all', authenticate, adminOnly, adminGetAllPrograms);
router.post('/', authenticate, adminOnly, uploadImage.single('thumbnail'), createProgram);
router.patch('/:id', authenticate, adminOnly, uploadImage.single('thumbnail'), updateProgram);
router.delete('/:id', authenticate, adminOnly, deleteProgram);

// ── Admin: Lessons (note param is :id for programId) ─────────────────────────
router.post(
  '/:id/lessons',
  authenticate,
  adminOnly,
  uploadLesson.fields([{ name: 'video', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  addLesson
);
router.patch(
  '/:id/lessons/:lessonId',
  authenticate,
  adminOnly,
  uploadLesson.fields([{ name: 'video', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  updateLesson
);
router.delete('/:id/lessons/:lessonId', authenticate, adminOnly, deleteLesson);

export default router;
