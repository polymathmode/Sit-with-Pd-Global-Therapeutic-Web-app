import { Request, Response } from 'express';
import { ProgramDeliveryFormat, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../types';

const DELIVERY_VALUES = new Set<string>(Object.values(ProgramDeliveryFormat));

function optionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v);
}

function parseOptionalInt(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) throw new AppError(`${field} must be a whole number.`, 400);
  return n;
}

function parseOptionalFloat(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = parseFloat(String(value));
  if (Number.isNaN(n)) throw new AppError(`${field} must be a number.`, 400);
  return n;
}

function parseDeliveryFormat(raw: unknown, required: boolean): ProgramDeliveryFormat | undefined {
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new AppError('deliveryFormat is required.', 400);
    return undefined;
  }
  const s = String(raw).trim().toUpperCase().replace(/-/g, '_');
  if (!DELIVERY_VALUES.has(s)) {
    throw new AppError('deliveryFormat must be ONLINE, IN_PERSON, or HYBRID.', 400);
  }
  return s as ProgramDeliveryFormat;
}

function parseLearningOutcomes(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppError('learningOutcomes must be valid JSON array of strings.', 400);
    }
    if (!Array.isArray(parsed)) {
      throw new AppError('learningOutcomes must be a JSON array of strings.', 400);
    }
    return parsed.map((s) => String(s).trim()).filter(Boolean);
  }
  throw new AppError('learningOutcomes must be a JSON array or JSON string.', 400);
}

// ── PUBLIC: Get all published programs ───────────────────────────────────────
export const getAllPrograms = catchAsync(async (_req: Request, res: Response) => {
  const programs = await prisma.program.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      title: true,
      description: true,
      summary: true,
      category: true,
      price: true,
      thumbnail: true,
      durationWeeks: true,
      hoursPerWeek: true,
      deliveryFormat: true,
      certificateLabel: true,
      learningOutcomes: true,
      isPublished: true,
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
  const {
    title,
    description,
    price,
    summary,
    category,
    durationWeeks,
    hoursPerWeek,
    deliveryFormat,
    certificateLabel,
    learningOutcomes: learningOutcomesRaw,
  } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path || null;

  const learningOutcomes = parseLearningOutcomes(learningOutcomesRaw) ?? [];
  const format = parseDeliveryFormat(deliveryFormat, false) ?? ProgramDeliveryFormat.ONLINE;

  const data: Prisma.ProgramCreateInput = {
    title,
    description,
    price: parseFloat(price),
    thumbnail,
    deliveryFormat: format,
    learningOutcomes,
    ...(optionalString(summary) !== undefined && { summary: optionalString(summary) }),
    ...(optionalString(category) !== undefined && { category: optionalString(category) }),
    ...(parseOptionalInt(durationWeeks, 'durationWeeks') !== undefined && {
      durationWeeks: parseOptionalInt(durationWeeks, 'durationWeeks'),
    }),
    ...(parseOptionalFloat(hoursPerWeek, 'hoursPerWeek') !== undefined && {
      hoursPerWeek: parseOptionalFloat(hoursPerWeek, 'hoursPerWeek'),
    }),
    ...(optionalString(certificateLabel) !== undefined && {
      certificateLabel: optionalString(certificateLabel),
    }),
  };

  const program = await prisma.program.create({ data });

  res.status(201).json({ success: true, message: 'Program created.', data: program });
});

// ── ADMIN: Update program ─────────────────────────────────────────────────────
export const updateProgram = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    description,
    price,
    isPublished,
    summary,
    category,
    durationWeeks,
    hoursPerWeek,
    deliveryFormat,
    certificateLabel,
    learningOutcomes: learningOutcomesRaw,
  } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path;

  const data: Prisma.ProgramUpdateInput = {
    ...(title && { title }),
    ...(description && { description }),
    ...(price && { price: parseFloat(price) }),
    ...(isPublished !== undefined && { isPublished: isPublished === 'true' }),
    ...(thumbnail && { thumbnail }),
    ...(summary !== undefined && { summary: optionalString(summary) }),
    ...(category !== undefined && { category: optionalString(category) }),
    ...(durationWeeks !== undefined && {
      durationWeeks: parseOptionalInt(durationWeeks, 'durationWeeks'),
    }),
    ...(hoursPerWeek !== undefined && {
      hoursPerWeek: parseOptionalFloat(hoursPerWeek, 'hoursPerWeek'),
    }),
    ...(deliveryFormat !== undefined &&
      deliveryFormat !== '' && {
        deliveryFormat: parseDeliveryFormat(deliveryFormat, true),
      }),
    ...(certificateLabel !== undefined && {
      certificateLabel: optionalString(certificateLabel),
    }),
    ...(learningOutcomesRaw !== undefined && {
      learningOutcomes: { set: parseLearningOutcomes(learningOutcomesRaw) ?? [] },
    }),
  };

  const program = await prisma.program.update({
    where: { id },
    data,
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
export const adminGetAllPrograms = catchAsync(async (_req: AuthRequest, res: Response) => {
  const programs = await prisma.program.findMany({
    include: { _count: { select: { lessons: true, purchases: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, message: 'All programs retrieved.', data: programs });
});
