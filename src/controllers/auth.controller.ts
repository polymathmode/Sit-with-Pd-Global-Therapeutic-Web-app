import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { sendPasswordResetEmail } from '../utils/email.service';
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

// ── Register ──────────────────────────────────────────────────────────────────
export const register = catchAsync(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already in use.', 400);

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { firstName, lastName, email, password: hashedPassword },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });

  const token = signToken(user.id, user.email, user.role);
  res.cookie(ACCESS_TOKEN_COOKIE, token, authCookieOptions());

  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: { user, token },
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid email or password.', 401);

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
      },
      token,
    },
  });
});

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success to avoid email enumeration attacks
  if (!user) {
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
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  res.json({ success: true, message: 'User retrieved.', data: user });
});
