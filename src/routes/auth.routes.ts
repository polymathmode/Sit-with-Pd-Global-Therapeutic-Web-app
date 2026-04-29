import { Router } from 'express';
import {
  register,
  login,
  googleAuth,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  updateProfile,
  updatePassword,
  updateNotificationPreferences,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { body, query } from 'express-validator';
import { isValidIanaTimezone } from '../lib/timezone';

/** Keep Gmail +tags (e.g. user+tag@gmail.com) distinct; default normalizeEmail strips them. */
const normalizeEmailOpts = { gmail_remove_subaddress: false };

const router = Router();

router.post('/register', [
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().normalizeEmail(normalizeEmailOpts).withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], validate, register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(normalizeEmailOpts).withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], validate, login);

router.post('/google', [
  body('idToken').trim().notEmpty().withMessage('Google idToken is required.'),
], validate, googleAuth);

router.post('/logout', logout);

router.get('/verify-email', [
  query('token').trim().notEmpty().withMessage('Verification token is required.'),
], validate, verifyEmail);

router.post('/resend-verification', authenticate, resendVerification);

router.get('/me', authenticate, getMe);

router.patch(
  '/profile',
  authenticate,
  [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty.'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty.'),
    body('email').optional().isEmail().normalizeEmail(normalizeEmailOpts).withMessage('Valid email is required.'),
    body('phone')
      .optional({ values: 'null' })
      .custom((v) => {
        if (v === null || v === undefined) return true;
        if (typeof v === 'string') return true;
        throw new Error('phone must be a string or null.');
      }),
    body('timezone')
      .optional({ values: 'null' })
      .custom((v) => {
        if (v === null || v === '') return true;
        if (typeof v === 'string' && isValidIanaTimezone(v)) return true;
        throw new Error('Invalid timezone.');
      }),
  ],
  validate,
  updateProfile
);

router.patch(
  '/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  ],
  validate,
  updatePassword
);

router.patch(
  '/notifications',
  authenticate,
  [
    body('notifyEmail').optional().isBoolean().withMessage('notifyEmail must be a boolean.'),
    body('notifyProgramReminders')
      .optional()
      .isBoolean()
      .withMessage('notifyProgramReminders must be a boolean.'),
    body('notifyPush').optional().isBoolean().withMessage('notifyPush must be a boolean.'),
  ],
  validate,
  updateNotificationPreferences
);

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(normalizeEmailOpts).withMessage('Valid email is required.'),
], validate, forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], validate, resetPassword);

export default router;
