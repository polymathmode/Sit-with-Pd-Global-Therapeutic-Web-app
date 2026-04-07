import express, { raw } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import authRoutes from './routes/auth.routes';
import programRoutes from './routes/program.routes';
import campRoutes from './routes/camp.routes';
import consultationRoutes from './routes/consultation.routes';
import paymentRoutes from './routes/payment.routes';
import { dashboardRouter, adminRouter } from './routes/admin.routes';
import { errorHandler } from './middleware/error.middleware';
import { calWebhook } from './controllers/consultation.cal.controller';
import { paystackWebhook } from './controllers/payment.controller';
import { processExpiredConsultationPayments } from './services/consultationExpiry.service';

const app = express();
app.set('trust proxy', 1);


// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter limit for auth endpoints
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

app.use(limiter);

// ── Body Parsing ──────────────────────────────────────────────────────────────
// Cal.com webhook: raw body required for x-cal-signature-256 HMAC (see Cal.com webhook docs)
app.post(
  '/api/consultations/cal-webhook',
  raw({ type: 'application/json' }),
  (req, res, next) => {
    Promise.resolve(calWebhook(req, res)).catch(next);
  }
);

app.post(
  '/api/payments/webhook',
  raw({ type: 'application/json' }),
  (req, res, next) => {
    Promise.resolve(paystackWebhook(req, res)).catch(next);
  }
);

// Optional: external cron (e.g. Render) — Bearer CRON_SECRET
app.post('/api/internal/cron/consultation-payment-expiry', async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  try {
    const processed = await processExpiredConsultationPayments();
    return res.json({ success: true, processed });
  } catch (e) {
    next(e);
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Well-Being API is running.', timestamp: new Date() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
