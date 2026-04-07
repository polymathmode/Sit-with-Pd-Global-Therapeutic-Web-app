import { Router } from 'express';
import {
  getServices,
  getServiceById,
  adminManualBookConsultation,
  getMyConsultations,
  getAllConsultations,
  updateConsultation,
  createService,
  updateService,
} from '../controllers/consultation.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/services', getServices);
router.get('/services/:id', getServiceById);

// ── User ──────────────────────────────────────────────────────────────────────
router.get('/my', authenticate, getMyConsultations);

// ── Admin: manual booking (no Cal.com) ─────────────────────────────────────────
router.post('/book', authenticate, adminOnly, adminManualBookConsultation);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/', authenticate, adminOnly, getAllConsultations);
router.patch('/:id', authenticate, adminOnly, updateConsultation);
router.post('/services', authenticate, adminOnly, createService);
router.patch('/services/:id', authenticate, adminOnly, updateService);

export default router;
