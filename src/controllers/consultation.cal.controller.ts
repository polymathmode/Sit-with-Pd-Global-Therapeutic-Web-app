import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { verifyCalWebhookSignature } from '../lib/cal';
import { createConsultationPaymentAndEmail } from '../services/consultationPayment';

/** Official trigger names: https://cal.com/docs/developing/guides/automation/webhooks */
const BOOKING_CREATED = 'BOOKING_CREATED';
const BOOKING_CANCELLED = 'BOOKING_CANCELLED';
const BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED';

const PAYMENT_HOLD_MS = 60 * 60 * 1000; // 1 hour

type CalPayload = {
  uid?: string;
  bookerUrl?: string;
  eventTypeId?: number;
  startTime?: string;
  endTime?: string;
  attendees?: Array<{ email?: string; name?: string }>;
  additionalNotes?: string;
};

type CalWebhookBody = {
  triggerEvent?: string;
  payload?: CalPayload;
};

function getPrimaryAttendeeEmail(payload: CalPayload): string | null {
  const email = payload.attendees?.[0]?.email?.trim().toLowerCase();
  return email || null;
}

/**
 * POST /api/consultations/cal-webhook
 * Raw body required for HMAC verification (mounted with express.raw).
 */
export const calWebhook = async (req: Request, res: Response) => {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ success: false, message: 'Invalid body.' });
  }

  const signature = req.headers['x-cal-signature-256'] as string | undefined;
  if (!secret) {
    console.error('CAL_WEBHOOK_SECRET is not set');
    return res.status(500).json({ success: false, message: 'Webhook not configured.' });
  }
  if (!verifyCalWebhookSignature(rawBody, signature, secret)) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
  }

  let body: CalWebhookBody;
  try {
    body = JSON.parse(rawBody.toString('utf8')) as CalWebhookBody;
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON.' });
  }

  const trigger = body.triggerEvent;
  const p = body.payload;
  if (!trigger || !p) {
    return res.status(400).json({ success: false, message: 'Missing trigger or payload.' });
  }

  try {
    if (trigger === BOOKING_CREATED) {
      await handleBookingCreated(p);
    } else if (trigger === BOOKING_CANCELLED) {
      await handleBookingCancelled(p);
    } else if (trigger === BOOKING_RESCHEDULED) {
      await handleBookingRescheduled(p);
    }
  } catch (err) {
    console.error('Cal.com webhook handler error:', err);
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  }

  return res.status(200).json({ success: true, message: 'Webhook received.' });
};

async function handleBookingCreated(p: CalPayload) {
  const uid = p.uid;
  if (!uid) {
    console.warn('BOOKING_CREATED missing uid');
    return;
  }

  const existing = await prisma.consultation.findUnique({ where: { calBookingId: uid } });
  if (existing) {
    return;
  }

  const eventTypeId = p.eventTypeId;
  if (eventTypeId == null) {
    console.warn('BOOKING_CREATED missing eventTypeId');
    return;
  }

  const attendeeEmail = getPrimaryAttendeeEmail(p);
  if (!attendeeEmail) {
    console.warn('BOOKING_CREATED missing attendee email');
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: attendeeEmail } });
  if (!user) {
    console.warn(`BOOKING_CREATED: no user for email ${attendeeEmail}`);
    return;
  }

  const service = await prisma.consultationService.findFirst({
    where: { calEventTypeId: eventTypeId, isActive: true },
  });
  if (!service) {
    console.warn(
      `BOOKING_CREATED: no ConsultationService with calEventTypeId=${eventTypeId}. Set calEventTypeId in DB to match Cal.com event type.`
    );
    return;
  }

  const start = p.startTime ? new Date(p.startTime) : null;
  const expiresAt = new Date(Date.now() + PAYMENT_HOLD_MS);
  const bookerUrl = p.bookerUrl || `https://app.cal.com/booking/${uid}`;

  const consultation = await prisma.consultation.create({
    data: {
      userId: user.id,
      serviceId: service.id,
      status: 'PENDING_PAYMENT',
      calBookingId: uid,
      calBookingUrl: bookerUrl,
      preferredDate: start,
      confirmedDate: start,
      paymentExpiresAt: expiresAt,
      notes: p.additionalNotes || null,
    },
  });

  await createConsultationPaymentAndEmail(consultation.id);
}

async function handleBookingCancelled(p: CalPayload) {
  const uid = p.uid;
  if (!uid) return;

  const row = await prisma.consultation.findUnique({
    where: { calBookingId: uid },
    include: { payment: true },
  });
  if (!row) return;

  await prisma.$transaction(async (tx) => {
    await tx.consultation.update({
      where: { id: row.id },
      data: { status: 'CANCELLED' },
    });
    if (row.payment && row.payment.status === 'PENDING') {
      await tx.payment.update({
        where: { id: row.payment.id },
        data: { status: 'FAILED' },
      });
    }
  });
}

async function handleBookingRescheduled(p: CalPayload) {
  const uid = p.uid;
  if (!uid || !p.startTime) return;

  const start = new Date(p.startTime);
  await prisma.consultation.updateMany({
    where: { calBookingId: uid },
    data: { confirmedDate: start, preferredDate: start },
  });
}
