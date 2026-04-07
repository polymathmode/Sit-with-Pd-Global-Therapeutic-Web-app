import prisma from '../config/prisma';
import { cancelCalBooking } from '../lib/cal';

const REASON = 'Payment not completed within the allowed time.';

/**
 * Finds consultations in PENDING_PAYMENT past paymentExpiresAt, cancels Cal.com booking,
 * marks consultation CANCELLED and linked payment FAILED.
 */
export async function processExpiredConsultationPayments(): Promise<number> {
  const now = new Date();
  const expired = await prisma.consultation.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      paymentExpiresAt: { lt: now },
      calBookingId: { not: null },
    },
    include: { payment: true },
  });

  let n = 0;
  for (const c of expired) {
    const uid = c.calBookingId!;
    await cancelCalBooking(uid, REASON);

    await prisma.$transaction(async (tx) => {
      await tx.consultation.update({
        where: { id: c.id },
        data: { status: 'CANCELLED', calBookingUrl: null },
      });
      if (c.payment) {
        await tx.payment.update({
          where: { id: c.payment.id },
          data: { status: 'FAILED' },
        });
      }
    });
    n += 1;
  }

  if (n > 0) {
    console.log(`[consultation-expiry] Processed ${n} expired PENDING_PAYMENT consultation(s).`);
  }
  return n;
}
