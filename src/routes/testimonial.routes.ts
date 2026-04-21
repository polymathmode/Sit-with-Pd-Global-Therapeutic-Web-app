import { Router } from 'express';
import {
  getTestimonials,
  getTestimonialsAdmin,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from '../controllers/testimonial.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { uploadImage } from '../middleware/upload.middleware';

const router = Router();

// ── Admin (declared before /:id so it isn't captured by the param route) ─────
router.get('/admin/all', authenticate, adminOnly, getTestimonialsAdmin);

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getTestimonials);
router.get('/:id', getTestimonialById);

// ── Admin mutations ───────────────────────────────────────────────────────────
router.post('/', authenticate, adminOnly, uploadImage.single('avatar'), createTestimonial);
router.patch('/:id', authenticate, adminOnly, uploadImage.single('avatar'), updateTestimonial);
router.delete('/:id', authenticate, adminOnly, deleteTestimonial);

export default router;
