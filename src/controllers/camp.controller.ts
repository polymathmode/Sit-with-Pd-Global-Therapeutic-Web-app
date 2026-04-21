import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { catchAsync, AppError } from '../middleware/error.middleware';
import { AuthRequest, ApplicantDetails } from '../types';

// ─────────────────────────────────────────────
// SHARED INCLUDES
// ─────────────────────────────────────────────

// Public-facing camp shape: everything the marketing page needs in one payload.
const publicCampInclude = {
  tiers: { orderBy: { order: 'asc' as const } },
  images: { orderBy: { order: 'asc' as const } },
  testimonials: {
    where: { isPublished: true },
    orderBy: { order: 'asc' as const },
  },
  _count: { select: { registrations: true } },
};

// Helper: how many seats have already been claimed for a camp.
async function getSeatsTaken(campId: string): Promise<number> {
  const agg = await prisma.campRegistration.aggregate({
    where: { campId },
    _sum: { participantCount: true },
  });
  return agg._sum.participantCount ?? 0;
}

// Helper: count existing units sold of a specific tier.
async function getTierUnitsSold(tierId: string): Promise<number> {
  return prisma.campRegistration.count({ where: { tierId } });
}

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

// GET /api/camps — List all upcoming/ongoing camps
export const getAllCamps = catchAsync(async (_req: Request, res: Response) => {
  const camps = await prisma.camp.findMany({
    where: { status: { in: ['UPCOMING', 'ONGOING'] } },
    orderBy: { startDate: 'asc' },
    include: publicCampInclude,
  });

  const withSeats = await Promise.all(
    camps.map(async (camp) => ({
      ...camp,
      seatsTaken: await getSeatsTaken(camp.id),
      seatsRemaining: Math.max(camp.capacity - (await getSeatsTaken(camp.id)), 0),
    }))
  );

  res.json({ success: true, message: 'Camps fetched.', data: withSeats });
});

// GET /api/camps/current — Next upcoming camp (the "Annual Camping Programme" featured event)
export const getCurrentCamp = catchAsync(async (_req: Request, res: Response) => {
  const camp = await prisma.camp.findFirst({
    where: { status: 'UPCOMING' },
    orderBy: { startDate: 'asc' },
    include: publicCampInclude,
  });

  if (!camp) {
    res.json({ success: true, message: 'No upcoming camp scheduled.', data: null });
    return;
  }

  const seatsTaken = await getSeatsTaken(camp.id);

  res.json({
    success: true,
    message: 'Current camp fetched.',
    data: { ...camp, seatsTaken, seatsRemaining: Math.max(camp.capacity - seatsTaken, 0) },
  });
});

// GET /api/camps/:id — Single camp detail
export const getCampById = catchAsync(async (req: Request, res: Response) => {
  const camp = await prisma.camp.findUnique({
    where: { id: req.params.id },
    include: publicCampInclude,
  });

  if (!camp) throw new AppError('Camp not found.', 404);

  const seatsTaken = await getSeatsTaken(camp.id);

  res.json({
    success: true,
    message: 'Camp fetched.',
    data: { ...camp, seatsTaken, seatsRemaining: Math.max(camp.capacity - seatsTaken, 0) },
  });
});

// ─────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────

// POST /api/camps/:id/register — Submit camp application (creates registration; payment handled separately)
// Body: { tierId: string, applicantDetails?: ApplicantDetails }
export const registerForCamp = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const campId = req.params.id;
  const { tierId, applicantDetails } = req.body as {
    tierId?: string;
    applicantDetails?: ApplicantDetails;
  };

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    include: { tiers: true },
  });
  if (!camp) throw new AppError('Camp not found.', 404);
  if (camp.status !== 'UPCOMING') {
    throw new AppError('This camp is no longer accepting applications.', 400);
  }

  // Resolve tier (required if camp has tiers configured)
  let tier = null as (typeof camp.tiers)[number] | null;
  let participantCount = 1;

  if (camp.tiers.length > 0) {
    if (!tierId) throw new AppError('Please select a participation tier.', 400);
    tier = camp.tiers.find((t) => t.id === tierId) ?? null;
    if (!tier) throw new AppError('Invalid tier selected.', 400);
    participantCount = tier.seatsPerUnit;

    if (tier.maxUnits != null) {
      const sold = await getTierUnitsSold(tier.id);
      if (sold >= tier.maxUnits) {
        throw new AppError(`The "${tier.label}" package is sold out.`, 400);
      }
    }
  }

  // Seat-based capacity check (sums participantCount across all registrations)
  const seatsTaken = await getSeatsTaken(campId);
  if (seatsTaken + participantCount > camp.capacity) {
    throw new AppError('Not enough spots remaining for this selection.', 400);
  }

  const existing = await prisma.campRegistration.findUnique({
    where: { userId_campId: { userId, campId } },
  });
  if (existing) throw new AppError('You have already applied for this camp.', 400);

  // Validate applicantDetails party size matches the tier (e.g. Family of 4 needs 3 party members)
  if (tier && participantCount > 1) {
    const partySize = applicantDetails?.partyMembers?.length ?? 0;
    if (partySize < participantCount - 1) {
      throw new AppError(
        `The "${tier.label}" package covers ${participantCount} people. Please list ${
          participantCount - 1
        } additional party member(s).`,
        400
      );
    }
  }

  const registration = await prisma.campRegistration.create({
    data: {
      userId,
      campId,
      tierId: tier?.id,
      participantCount,
      applicantDetails: (applicantDetails ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
    include: { camp: true, tier: true },
  });

  res.status(201).json({
    success: true,
    message: 'Application submitted. Please complete payment.',
    data: registration,
  });
});

// ─────────────────────────────────────────────
// ADMIN ROUTES — CAMPS
// ─────────────────────────────────────────────

// POST /api/camps — Create a camp
export const createCamp = catchAsync(async (req: AuthRequest, res: Response) => {
  const { title, description, location, price, capacity, startDate, endDate, currency, benefits } =
    req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path;

  const parsedBenefits = parseStringArray(benefits);

  const camp = await prisma.camp.create({
    data: {
      title,
      description,
      location,
      ...(price !== undefined && price !== '' && { price: parseFloat(price) }),
      capacity: parseInt(capacity),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ...(currency && { currency }),
      benefits: parsedBenefits,
      thumbnail,
    },
  });

  res.status(201).json({ success: true, message: 'Camp created.', data: camp });
});

// PATCH /api/camps/:id — Update a camp
export const updateCamp = catchAsync(async (req: AuthRequest, res: Response) => {
  const {
    title,
    description,
    location,
    price,
    capacity,
    startDate,
    endDate,
    status,
    currency,
    benefits,
  } = req.body;
  const thumbnail = (req.file as Express.Multer.File & { path: string })?.path;

  const camp = await prisma.camp.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(location && { location }),
      ...(price !== undefined && price !== '' && { price: parseFloat(price) }),
      ...(capacity && { capacity: parseInt(capacity) }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(status && { status }),
      ...(currency && { currency }),
      ...(benefits !== undefined && { benefits: parseStringArray(benefits) }),
      ...(thumbnail && { thumbnail }),
    },
  });

  res.json({ success: true, message: 'Camp updated.', data: camp });
});

// DELETE /api/camps/:id — Delete a camp (cascades to tiers, images, testimonials)
export const deleteCamp = catchAsync(async (req: Request, res: Response) => {
  await prisma.camp.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Camp deleted.' });
});

// GET /api/camps/:id/participants — View who applied (admin)
export const getCampParticipants = catchAsync(async (req: Request, res: Response) => {
  const registrations = await prisma.campRegistration.findMany({
    where: { campId: req.params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      tier: { select: { id: true, label: true, price: true, seatsPerUnit: true } },
      payment: { select: { status: true, amount: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, message: 'Participants fetched.', data: registrations });
});

// ─────────────────────────────────────────────
// ADMIN ROUTES — TIERS
// ─────────────────────────────────────────────

// POST /api/camps/:campId/tiers — Create a participation tier
export const createCampTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const { campId } = req.params;
  const { label, description, price, inclusions, seatsPerUnit, maxUnits, order, isFeatured } =
    req.body;

  if (!label || price === undefined) {
    throw new AppError('label and price are required.', 400);
  }

  const camp = await prisma.camp.findUnique({ where: { id: campId } });
  if (!camp) throw new AppError('Camp not found.', 404);

  const tier = await prisma.campTier.create({
    data: {
      campId,
      label,
      description,
      price: parseFloat(price),
      inclusions: parseStringArray(inclusions),
      seatsPerUnit: seatsPerUnit ? parseInt(seatsPerUnit) : 1,
      maxUnits: maxUnits ? parseInt(maxUnits) : null,
      order: order ? parseInt(order) : 0,
      isFeatured: parseBoolean(isFeatured),
    },
  });

  res.status(201).json({ success: true, message: 'Tier created.', data: tier });
});

// PATCH /api/camps/:campId/tiers/:tierId — Update a tier
export const updateCampTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const { campId, tierId } = req.params;
  const { label, description, price, inclusions, seatsPerUnit, maxUnits, order, isFeatured } =
    req.body;

  const existing = await prisma.campTier.findUnique({ where: { id: tierId } });
  if (!existing || existing.campId !== campId) throw new AppError('Tier not found.', 404);

  const tier = await prisma.campTier.update({
    where: { id: tierId },
    data: {
      ...(label && { label }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && price !== '' && { price: parseFloat(price) }),
      ...(inclusions !== undefined && { inclusions: parseStringArray(inclusions) }),
      ...(seatsPerUnit !== undefined && { seatsPerUnit: parseInt(seatsPerUnit) }),
      ...(maxUnits !== undefined && { maxUnits: maxUnits === null || maxUnits === '' ? null : parseInt(maxUnits) }),
      ...(order !== undefined && { order: parseInt(order) }),
      ...(isFeatured !== undefined && { isFeatured: parseBoolean(isFeatured) }),
    },
  });

  res.json({ success: true, message: 'Tier updated.', data: tier });
});

// DELETE /api/camps/:campId/tiers/:tierId — Remove a tier
export const deleteCampTier = catchAsync(async (req: Request, res: Response) => {
  const { campId, tierId } = req.params;
  const existing = await prisma.campTier.findUnique({ where: { id: tierId } });
  if (!existing || existing.campId !== campId) throw new AppError('Tier not found.', 404);

  await prisma.campTier.delete({ where: { id: tierId } });
  res.json({ success: true, message: 'Tier deleted.' });
});

// ─────────────────────────────────────────────
// ADMIN ROUTES — GALLERY IMAGES
// ─────────────────────────────────────────────

// POST /api/camps/:campId/images — Upload one or more gallery images (field: "images")
export const uploadCampImages = catchAsync(async (req: AuthRequest, res: Response) => {
  const { campId } = req.params;
  const files = req.files as (Express.Multer.File & { path: string })[] | undefined;
  const captions = parseStringArray(req.body?.captions);

  if (!files || files.length === 0) {
    throw new AppError('No images uploaded. Use field name "images".', 400);
  }

  const camp = await prisma.camp.findUnique({ where: { id: campId } });
  if (!camp) throw new AppError('Camp not found.', 404);

  const existingCount = await prisma.campImage.count({ where: { campId } });

  const created = await prisma.$transaction(
    files.map((file, i) =>
      prisma.campImage.create({
        data: {
          campId,
          url: file.path,
          caption: captions[i] || null,
          order: existingCount + i,
        },
      })
    )
  );

  res.status(201).json({ success: true, message: 'Images uploaded.', data: created });
});

// PATCH /api/camps/:campId/images/:imageId — Update caption/order of a gallery image
export const updateCampImage = catchAsync(async (req: AuthRequest, res: Response) => {
  const { campId, imageId } = req.params;
  const { caption, order } = req.body;

  const existing = await prisma.campImage.findUnique({ where: { id: imageId } });
  if (!existing || existing.campId !== campId) throw new AppError('Image not found.', 404);

  const image = await prisma.campImage.update({
    where: { id: imageId },
    data: {
      ...(caption !== undefined && { caption }),
      ...(order !== undefined && { order: parseInt(order) }),
    },
  });

  res.json({ success: true, message: 'Image updated.', data: image });
});

// DELETE /api/camps/:campId/images/:imageId — Remove a gallery image
export const deleteCampImage = catchAsync(async (req: Request, res: Response) => {
  const { campId, imageId } = req.params;
  const existing = await prisma.campImage.findUnique({ where: { id: imageId } });
  if (!existing || existing.campId !== campId) throw new AppError('Image not found.', 404);

  await prisma.campImage.delete({ where: { id: imageId } });
  res.json({ success: true, message: 'Image deleted.' });
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Accepts an array, JSON string, or comma-separated string and normalises to string[].
// Useful when the same endpoint accepts both `application/json` and `multipart/form-data`.
function parseStringArray(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map((v) => String(v).trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // fall through to CSV
    }
  }
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') return ['true', '1', 'yes', 'on'].includes(input.toLowerCase());
  return false;
}
