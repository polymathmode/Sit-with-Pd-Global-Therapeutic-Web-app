import { Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync } from '../middleware/error.middleware';
import { AuthRequest } from '../types';

// GET /api/dashboard — User's full dashboard data
export const getDashboard = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const [purchases, campRegistrations, consultations] = await Promise.all([
    // Purchased programs with lesson count
    prisma.purchase.findMany({
      where: { userId },
      include: {
        program: {
          include: { _count: { select: { weeks: true } } },
        },
        payment: { select: { status: true, amount: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Camp registrations
    prisma.campRegistration.findMany({
      where: { userId },
      include: {
        camp: true,
        payment: { select: { status: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Consultation bookings
    prisma.consultation.findMany({
      where: { userId },
      include: {
        service: true,
        payment: { select: { status: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({
    success: true,
    message: 'Dashboard data fetched.',
    data: { purchases, campRegistrations, consultations },
  });
});

// GET /api/dashboard/programs/:programId — Access program content (lessons)
export const getProgramContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { programId } = req.params;

  // Confirm user has purchased this program
  const purchase = await prisma.purchase.findUnique({
    where: { userId_programId: { userId, programId } },
    include: { payment: true },
  });

  if (!purchase || purchase.payment?.status !== 'SUCCESS') {
    return res.status(403).json({
      success: false,
      message: 'You have not purchased this program.',
    });
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      weeks: {
        orderBy: { order: 'asc' },
        include: {
          modules: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  res.json({ success: true, message: 'Program content fetched.', data: program });
});
