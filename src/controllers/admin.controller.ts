import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { fetchCalEventTypesList } from '../lib/cal';
import { catchAsync, AppError } from '../middleware/error.middleware';

// ── Dashboard Stats ───────────────────────────────────────────────────────────
// GET /api/admin/stats
export const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    totalPrograms,
    totalCamps,
    totalConsultations,
    totalRevenue,
    recentPayments,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.program.count(),
    prisma.camp.count(),
    prisma.consultation.count(),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { status: 'SUCCESS' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  res.json({
    success: true,
    message: 'Dashboard stats fetched.',
    data: {
      totalUsers,
      totalPrograms,
      totalCamps,
      totalConsultations,
      totalRevenue: totalRevenue._sum.amount || 0,
      recentPayments,
    },
  });
});

// ── All Users ─────────────────────────────────────────────────────────────────
// GET /api/admin/users
export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isEmailVerified: true,
        createdAt: true,
        _count: {
          select: { purchases: true, campRegistrations: true, consultations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: { role: 'USER' } }),
  ]);

  res.json({
    success: true,
    message: 'Users fetched.',
    data: { users, total, page, pages: Math.ceil(total / limit) },
  });
});

// ── Single User Detail ────────────────────────────────────────────────────────
// GET /api/admin/users/:id
export const getUserById = catchAsync(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isEmailVerified: true,
      createdAt: true,
      purchases: { include: { program: { select: { title: true, price: true } } } },
      campRegistrations: { include: { camp: { select: { title: true, startDate: true } } } },
      consultations: { include: { service: { select: { title: true } } } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  res.json({ success: true, message: 'User detail fetched.', data: user });
});

// ── Cal.com event types (admin picker) ────────────────────────────────────────
// GET /api/admin/cal/event-types?username=optional-cal-username
export const getCalEventTypes = catchAsync(async (req: Request, res: Response) => {
  if (!process.env.CAL_API_KEY?.trim()) {
    throw new AppError('Cal.com API is not configured (CAL_API_KEY).', 503);
  }

  const username =
    typeof req.query.username === 'string' && req.query.username.trim() !== ''
      ? req.query.username.trim()
      : undefined;

  try {
    const data = await fetchCalEventTypesList({ username });
    res.json({ success: true, message: 'Cal.com event types fetched.', data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cal.com request failed';
    throw new AppError(msg, 502);
  }
});
