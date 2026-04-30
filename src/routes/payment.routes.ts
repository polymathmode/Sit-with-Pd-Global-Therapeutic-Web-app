import { Router } from 'express';
import {
  initializePayment,
  verifyPayment,
  getAllPayments,
} from '../controllers/payment.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { enforceVerifiedEmailIfRequired } from '../middleware/platformSettings.middleware';

const router = Router();

// POST /api/payments/webhook — mounted in app.ts with raw body (before express.json)

// ── User ──────────────────────────────────────────────────────────────────────
router.post(
  '/initialize',
  authenticate,
  enforceVerifiedEmailIfRequired,
  initializePayment
);
router.get('/verify/:reference', verifyPayment);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/', authenticate, adminOnly, getAllPayments);

export default router;
