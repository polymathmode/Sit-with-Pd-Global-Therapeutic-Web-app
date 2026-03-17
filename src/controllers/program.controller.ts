import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../types';

// ── PUBLIC: Get all published programs ───────────────────────────────────────
export const getAllPrograms = catchAsync(async (_req: Request, res: Response) => {
  const programs = await prisma.program.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      thumbnail: true,
      createdAt: true,
      _count: { select: { lessons: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, message: 'Programs retrieved.', data: programs });
});

// ── PUBLIC: Get single program details ────────────────────────────────────────
export const getProgramById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const program = await prisma.program.findUnique({
    where: { id, isPublished: true },
    include: {
      // Only show lesson titles/descriptions publicly — not video URLs
      lessons: {
        select: { id: true, title: true, description: true, order: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!program) throw new AppError('Program not found.', 404);

  res.json({ success: true, message: 'Program retrieved.', data: program });
});

// ── ADMIN: Create program ─────────────────────────────────────────────────────
export const createProgram = catchAsync(async (req: Request, res: Response) => {
  const { title, description, price } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path || null;

  const program = await prisma.program.create({
    data: { title, description, price: parseFloat(price), thumbnail },
  });

  res.status(201).json({ success: true, message: 'Program created.', data: program });
});

// ── ADMIN: Update program ─────────────────────────────────────────────────────
export const updateProgram = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, price, isPublished } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path;

  const program = await prisma.program.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(price && { price: parseFloat(price) }),
      ...(isPublished !== undefined && { isPublished: isPublished === 'true' }),
      ...(thumbnail && { thumbnail }),
    },
  });

  res.json({ success: true, message: 'Program updated.', data: program });
});

// ── ADMIN: Delete program ─────────────────────────────────────────────────────
export const deleteProgram = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.program.delete({ where: { id } });
  res.json({ success: true, message: 'Program deleted.' });
});

// ── ADMIN: Add lesson to program ──────────────────────────────────────────────
export const addLesson = catchAsync(async (req: Request, res: Response) => {
  const { id: programId } = req.params;
  const { title, description, content, order } = req.body;

  // Supports both single file upload and multi-field upload
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const videoUrl = files?.video?.[0]?.path || (req.file as Express.Multer.File & { path: string })?.path || null;
  const fileUrl = files?.file?.[0]?.path || null;

  const lesson = await prisma.lesson.create({
    data: {
      programId,
      title,
      description,
      content,
      videoUrl,
      fileUrl,
      order: parseInt(order),
    },
  });

  res.status(201).json({ success: true, message: 'Lesson added.', data: lesson });
});

// ── ADMIN: Update lesson ──────────────────────────────────────────────────────
export const updateLesson = catchAsync(async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  const { title, description, content, order } = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const videoUrl = files?.video?.[0]?.path || null;
  const fileUrl = files?.file?.[0]?.path || null;

  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(content && { content }),
      ...(order && { order: parseInt(order) }),
      ...(videoUrl && { videoUrl }),
      ...(fileUrl && { fileUrl }),
    },
  });

  res.json({ success: true, message: 'Lesson updated.', data: lesson });
});

// ── ADMIN: Delete lesson ──────────────────────────────────────────────────────
export const deleteLesson = catchAsync(async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  await prisma.lesson.delete({ where: { id: lessonId } });
  res.json({ success: true, message: 'Lesson deleted.' });
});

// ── ADMIN: Get all programs including unpublished ─────────────────────────────
export const adminGetAllPrograms = catchAsync(async (_req: Request, res: Response) => {
  const programs = await prisma.program.findMany({
    include: { _count: { select: { lessons: true, purchases: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, message: 'All programs retrieved.', data: programs });
});
