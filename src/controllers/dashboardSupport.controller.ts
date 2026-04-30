import { Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import {
  sendDashboardFacilitatorMessageEmail,
  sendDashboardSupportRequestEmail,
} from '../utils/email.service';
import { AuthRequest } from '../types';
import { ensurePlatformSettings } from '../services/platformSettings.service';

const DEFAULT_SUPPORT_SUBJECT = 'Support request from dashboard';

function userDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'User';
}

/** POST /api/dashboard/support/contact */
export const contactDashboardSupport = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { message, subject } = req.body as { message?: string; subject?: string };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) throw new AppError('User not found.', 404);

  const settings = await ensurePlatformSettings();
  const platformTo = settings.supportEmail?.trim();
  if (!platformTo) {
    throw new AppError('Support email is not configured. Please contact an administrator.', 503);
  }

  const subjectLine =
    typeof subject === 'string' && subject.trim() ? subject.trim().slice(0, 200) : DEFAULT_SUPPORT_SUBJECT;

  await sendDashboardSupportRequestEmail({
    to: platformTo,
    userEmail: user.email,
    userName: userDisplayName(user.firstName, user.lastName),
    subjectLine,
    message: typeof message === 'string' ? message : '',
  });

  res.json({
    success: true,
    message: 'Your message has been sent to support. You may receive a reply at your account email.',
  });
});

/** POST /api/dashboard/programs/:programId/contact-facilitator */
export const contactProgramFacilitator = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { programId } = req.params;
  const { message, subject } = req.body as { message?: string; subject?: string };

  const purchase = await prisma.purchase.findUnique({
    where: { userId_programId: { userId, programId } },
    include: { payment: true },
  });

  if (!purchase || purchase.payment?.status !== 'SUCCESS') {
    throw new AppError('You must be enrolled in this program to message the facilitator.', 403);
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: {
      title: true,
      facilitatorEmail: true,
      facilitatorName: true,
    },
  });
  if (!program) throw new AppError('Program not found.', 404);

  const to = program.facilitatorEmail?.trim();
  if (!to) {
    throw new AppError(
      'No facilitator email is set for this program. Please use Contact support instead.',
      400
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) throw new AppError('User not found.', 404);

  const subjectLine =
    typeof subject === 'string' && subject.trim()
      ? subject.trim().slice(0, 200)
      : `Message about “${program.title}”`;

  await sendDashboardFacilitatorMessageEmail({
    to,
    userEmail: user.email,
    userName: userDisplayName(user.firstName, user.lastName),
    programTitle: program.title,
    facilitatorName: program.facilitatorName,
    subjectLine,
    message: typeof message === 'string' ? message : '',
  });

  res.json({
    success: true,
    message:
      'Your message has been sent to the programme facilitator. Replies normally go to your account email.',
  });
});
