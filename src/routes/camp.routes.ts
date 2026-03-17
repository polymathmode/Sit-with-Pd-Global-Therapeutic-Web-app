import { Router } from 'express';
import {
  getAllCamps,
  getCampById,
  registerForCamp,
  createCamp,
  updateCamp,
  deleteCamp,
  getCampParticipants,
} from '../controllers/camp.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { uploadImage } from '../middleware/upload.middleware';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getAllCamps);
router.get('/:id', getCampById);

// ── User ──────────────────────────────────────────────────────────────────────
router.post('/:id/register', authenticate, registerForCamp);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.post('/', authenticate, adminOnly, uploadImage.single('thumbnail'), createCamp);
router.patch('/:id', authenticate, adminOnly, uploadImage.single('thumbnail'), updateCamp);
router.delete('/:id', authenticate, adminOnly, deleteCamp);
router.get('/:id/participants', authenticate, adminOnly, getCampParticipants);

export default router;
