import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from '../utils/email.service';
import { getGoogleClientIds, verifyGoogleIdToken } from '../utils/googleAuth';
import { ACCESS_TOKEN_COOKIE, authCookieOptions, clearAuthCookie } from '../lib/authCookie';
import { AuthRequest } from '../types';

// ── Generate JWT ──────────────────────────────────────────────────────────────
const signToken = (id: string, email: string, role: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.sign({ id, email, role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
};

const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

const publicUserFields = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isEmailVerified: true,
} as const;

// ── Register ──────────────────────────────────────────────────────────────────
export const register = catchAsync(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already in use.', 400);

  const hashedPassword = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry,
    },
    select: publicUserFields,
  });

  await sendEmailVerificationEmail(user.email, user.firstName, verificationToken);

  const token = signToken(user.id, user.email, user.role);
  res.cookie(ACCESS_TOKEN_COOKIE, token, authCookieOptions());

  res.status(201).json({
    success: true,
    message: 'Account created successfully. Please check your email to verify your address.',
    data: { user, token },
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid email or password.', 401);

  if (!user.password) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AppError('Invalid email or password.', 401);

  const token = signToken(user.id, user.email, user.role);
  res.cookie(ACCESS_TOKEN_COOKIE, token, authCookieOptions());

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    },
  });
});

// ── Google Sign-In (ID token from Google Identity Services / mobile SDK) ──────
export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  if (getGoogleClientIds().length === 0) {
    throw new AppError('Google sign-in is not configured.', 503);
  }

  const { idToken } = req.body as { idToken?: string };
  let profile;
  try {
    profile = await verifyGoogleIdToken(idToken!);
  } catch {
    throw new AppError('Invalid or expired Google credential.', 401);
  }

  let user = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
    select: publicUserFields,
  });

  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
        throw new AppError('This email is already linked to a different Google account.', 409);
      }
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.googleId,
          isEmailVerified: true,
        },
        select: publicUserFields,
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          googleId: profile.googleId,
          isEmailVerified: true,
        },
        select: publicUserFields,
      });
    }
  }

  const token = signToken(user.id, user.email, user.role);
  res.cookie(ACCESS_TOKEN_COOKIE, token, authCookieOptions());

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    },
  });
});

// ── Verify email (link from email) ────────────────────────────────────────────
export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const token = req.query.token as string;

  const found = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpiry: { gt: new Date() },
    },
  });

  if (!found) throw new AppError('Verification link is invalid or has expired.', 400);

  await prisma.user.update({
    where: { id: found.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });

  res.json({ success: true, message: 'Email verified successfully.' });
});

// ── Resend verification email (logged-in, unverified users) ───────────────────
export const resendVerification = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);

  if (user.isEmailVerified) {
    return res.json({ success: true, message: 'Email is already verified.' });
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: verificationToken, emailVerificationExpiry },
  });

  await sendEmailVerificationEmail(user.email, user.firstName, verificationToken);

  res.json({ success: true, message: 'Verification email sent.' });
});

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success to avoid email enumeration attacks
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  if (!user.password) {
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetToken, passwordResetExpiry: expiry },
  });

  await sendPasswordResetEmail(user.email, user.firstName, resetToken);

  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

// ── Reset Password ────────────────────────────────────────────────────────────
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: { gt: new Date() },
    },
  });

  if (!user) throw new AppError('Reset token is invalid or has expired.', 400);

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  res.json({ success: true, message: 'Password reset successful. You can now log in.' });
});

// ── Logout — clear httpOnly auth cookie ───────────────────────────────────────
export const logout = catchAsync(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out.' });
});

// ── Get Current User (me) ─────────────────────────────────────────────────────
export const getMe = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserFields,
      createdAt: true,
    },
  });

  res.json({ success: true, message: 'User retrieved.', data: user });
});
