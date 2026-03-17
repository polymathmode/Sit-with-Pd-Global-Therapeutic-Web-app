import { Router, raw } from 'express';
import {
  initializePayment,
  paystackWebhook,
  verifyPayment,
  getAllPayments,
} from '../controllers/payment.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// Paystack webhook needs raw body to verify signature — must come BEFORE express.json()
router.post('/webhook', raw({ type: 'application/json' }), paystackWebhook);

// ── User ──────────────────────────────────────────────────────────────────────
router.post('/initialize', authenticate, initializePayment);
router.get('/verify/:reference', verifyPayment);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/', authenticate, adminOnly, getAllPayments);

export default router;
