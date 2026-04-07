import prisma from '../config/prisma';
import { sendConsultationPaymentLinkEmail } from '../utils/email.service';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE = 'https://api.paystack.co';

const PAYSTACK_PAYMENT_WINDOW_SECONDS = 60 * 60; // 1 hour — matches paymentExpiresAt

async function paystackRequest(endpoint: string, method = 'GET', body?: object) {
  const res = await fetch(`${PAYSTACK_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

/**
 * Creates a pending Paystack payment and emails the authorization URL.
 * Used after Cal.com BOOKING_CREATED webhook.
 */
export async function createConsultationPaymentAndEmail(consultationId: string): Promise<void> {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: { service: true, user: true },
  });

  if (!consultation) throw new Error('Consultation not found');
  if (consultation.status !== 'PENDING_PAYMENT') {
    throw new Error('Consultation is not awaiting payment');
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { consultationId, status: 'PENDING' },
  });
  if (existingPayment) {
    console.warn(`Payment already exists for consultation ${consultationId}`);
    return;
  }

  const user = consultation.user;
  const amount = consultation.service.price;
  const description = `Consultation: ${consultation.service.title}`;

  // Note: Paystack session timeout is usually set in the Paystack dashboard; align with 1h slot hold.
  const paystackResponse = (await paystackRequest('/transaction/initialize', 'POST', {
    email: user.email,
    amount: amount * 100,
    metadata: { userId: user.id, type: 'CONSULTATION', itemId: consultationId },
    callback_url: `${process.env.CLIENT_URL}/payment/verify`,
  })) as { status: boolean; data: { reference: string; authorization_url: string } };

  if (!paystackResponse.status) {
    throw new Error('Paystack initialize failed');
  }

  await prisma.payment.create({
    data: {
      userId: user.id,
      type: 'CONSULTATION',
      amount,
      status: 'PENDING',
      paystackRef: paystackResponse.data.reference,
      consultationId,
    },
  });

  await sendConsultationPaymentLinkEmail(
    user.email,
    user.firstName,
    consultation.service.title,
    paystackResponse.data.authorization_url,
    PAYSTACK_PAYMENT_WINDOW_SECONDS
  );
}
