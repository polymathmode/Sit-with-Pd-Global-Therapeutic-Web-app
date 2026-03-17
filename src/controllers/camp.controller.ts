import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../types';

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

// GET /api/camps — List all upcoming/published camps
export const getAllCamps = catchAsync(async (_req: Request, res: Response) => {
  const camps = await prisma.camp.findMany({
    where: { status: { in: ['UPCOMING', 'ONGOING'] } },
    orderBy: { startDate: 'asc' },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  res.json({ success: true, message: 'Camps fetched.', data: camps });
});

// GET /api/camps/:id — Get single camp detail
export const getCampById = catchAsync(async (req: Request, res: Response) => {
  const camp = await prisma.camp.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  if (!camp) throw new AppError('Camp not found.', 404);

  res.json({ success: true, message: 'Camp fetched.', data: camp });
});

// ─────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────

// POST /api/camps/:id/register — Initiate camp registration (creates record, payment handled separately)
export const registerForCamp = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const campId = req.params.id;

  const camp = await prisma.camp.findUnique({ where: { id: campId } });
  if (!camp) throw new AppError('Camp not found.', 404);
  if (camp.status !== 'UPCOMING') throw new AppError('This camp is no longer accepting registrations.', 400);

  // Check capacity
  const registrationCount = await prisma.campRegistration.count({ where: { campId } });
  if (registrationCount >= camp.capacity) throw new AppError('This camp is fully booked.', 400);

  // Check if already registered
  const existing = await prisma.campRegistration.findUnique({
    where: { userId_campId: { userId, campId } },
  });
  if (existing) throw new AppError('You are already registered for this camp.', 400);

  const registration = await prisma.campRegistration.create({
    data: { userId, campId },
    include: { camp: true },
  });

  res.status(201).json({
    success: true,
    message: 'Registration initiated. Please complete payment.',
    data: registration,
  });
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// POST /api/admin/camps — Create a camp
export const createCamp = catchAsync(async (req: AuthRequest, res: Response) => {
  const { title, description, location, price, capacity, startDate, endDate } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path;

  const camp = await prisma.camp.create({
    data: {
      title,
      description,
      location,
      price: parseFloat(price),
      capacity: parseInt(capacity),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      thumbnail,
    },
  });

  res.status(201).json({ success: true, message: 'Camp created.', data: camp });
});

// PATCH /api/admin/camps/:id — Update a camp
export const updateCamp = catchAsync(async (req: AuthRequest, res: Response) => {
  const { title, description, location, price, capacity, startDate, endDate, status } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path;

  const camp = await prisma.camp.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(location && { location }),
      ...(price && { price: parseFloat(price) }),
      ...(capacity && { capacity: parseInt(capacity) }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(status && { status }),
      ...(thumbnail && { thumbnail }),
    },
  });

  res.json({ success: true, message: 'Camp updated.', data: camp });
});

// DELETE /api/admin/camps/:id — Delete a camp
export const deleteCamp = catchAsync(async (req: Request, res: Response) => {
  await prisma.camp.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Camp deleted.' });
});

// GET /api/admin/camps/:id/participants — View who registered
export const getCampParticipants = catchAsync(async (req: Request, res: Response) => {
  const registrations = await prisma.campRegistration.findMany({
    where: { campId: req.params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      payment: { select: { status: true, amount: true, createdAt: true } },
    },
  });

  res.json({ success: true, message: 'Participants fetched.', data: registrations });
});
