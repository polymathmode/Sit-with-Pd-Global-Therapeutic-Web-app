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
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { body, query } from 'express-validator';

const router = Router();

router.post('/register', [
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], validate, register);

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
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

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
], validate, forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], validate, resetPassword);

export default router;
