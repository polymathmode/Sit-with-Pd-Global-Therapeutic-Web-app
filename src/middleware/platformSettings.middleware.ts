import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { ensurePlatformSettings } from '../services/platformSettings.service';
import { AuthRequest } from '../types';

/**
 * When platform `requireEmailVerification` is true, blocks non-admin users
 * who have not verified email (403).
 */
export async function enforceVerifiedEmailIfRequired(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const settings = await ensurePlatformSettings();
    if (!settings.requireEmailVerification) {
      next();
      return;
    }
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isEmailVerified: true, role: true },
    });
    if (user?.role === Role.ADMIN) {
      next();
      return;
    }
    if (!user?.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: 'Please verify your email to use this feature.',
      });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
