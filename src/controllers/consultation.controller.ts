import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../types';

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

// GET /api/consultations/services — List all active consultation services
export const getServices = catchAsync(async (_req: Request, res: Response) => {
  const services = await prisma.consultationService.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ success: true, message: 'Services fetched.', data: services });
});

// GET /api/consultations/services/:id — Single service detail
export const getServiceById = catchAsync(async (req: Request, res: Response) => {
  const service = await prisma.consultationService.findUnique({
    where: { id: req.params.id },
  });

  if (!service) throw new AppError('Service not found.', 404);

  res.json({ success: true, message: 'Service fetched.', data: service });
});

// ─────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────

// POST /api/consultations/book — Admin-only manual booking (no Cal.com); edge cases / support
export const adminManualBookConsultation = catchAsync(async (req: AuthRequest, res: Response) => {
  const { userId, serviceId, preferredDate, notes } = req.body;

  if (!userId || !serviceId) {
    throw new AppError('userId and serviceId are required.', 400);
  }

  const service = await prisma.consultationService.findUnique({ where: { id: serviceId } });
  if (!service || !service.isActive) throw new AppError('This consultation service is not available.', 400);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);

  const consultation = await prisma.consultation.create({
    data: {
      userId,
      serviceId,
      notes,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      status: 'PENDING',
    },
    include: { service: true, user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  res.status(201).json({
    success: true,
    message: 'Consultation created (manual). Complete payment via existing Paystack flow if needed.',
    data: consultation,
  });
});

// GET /api/consultations/my — User's own bookings
export const getMyConsultations = catchAsync(async (req: AuthRequest, res: Response) => {
  const consultations = await prisma.consultation.findMany({
    where: { userId: req.user!.id },
    include: {
      service: true,
      payment: { select: { status: true, amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, message: 'Consultations fetched.', data: consultations });
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// GET /api/admin/consultations — View all bookings
export const getAllConsultations = catchAsync(async (_req: Request, res: Response) => {
  const consultations = await prisma.consultation.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      service: true,
      payment: { select: { status: true, amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, message: 'All consultations fetched.', data: consultations });
});

// PATCH /api/admin/consultations/:id — Update status / confirm date
export const updateConsultation = catchAsync(async (req: Request, res: Response) => {
  const { status, confirmedDate } = req.body;

  const consultation = await prisma.consultation.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(confirmedDate && { confirmedDate: new Date(confirmedDate) }),
    },
    include: { user: true, service: true },
  });

  res.json({ success: true, message: 'Consultation updated.', data: consultation });
});

// POST /api/admin/consultations/services — Create a new service
export const createService = catchAsync(async (req: Request, res: Response) => {
  const { title, description, price, duration, calEventTypeId } = req.body;

  const service = await prisma.consultationService.create({
    data: {
      title,
      description,
      price: parseFloat(price),
      duration: parseInt(duration, 10),
      ...(calEventTypeId != null && calEventTypeId !== '' && { calEventTypeId: parseInt(calEventTypeId, 10) }),
    },
  });

  res.status(201).json({ success: true, message: 'Service created.', data: service });
});

// PATCH /api/admin/consultations/services/:id — Edit a service
export const updateService = catchAsync(async (req: Request, res: Response) => {
  const { title, description, price, duration, isActive, calEventTypeId } = req.body;

  const service = await prisma.consultationService.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(price != null && { price: parseFloat(price) }),
      ...(duration != null && { duration: parseInt(duration, 10) }),
      ...(isActive !== undefined && { isActive }),
      ...(calEventTypeId !== undefined && {
        calEventTypeId: calEventTypeId === null || calEventTypeId === '' ? null : parseInt(calEventTypeId, 10),
      }),
    },
  });

  res.json({ success: true, message: 'Service updated.', data: service });
});
