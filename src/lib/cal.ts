import crypto from 'crypto';

/**
 * Frontend: prefill the logged-in user’s email in the Cal embed `config` and enable
 * “Disable on Prefill” for the email field on the event type so it cannot be edited.
 * @see https://cal.com/help/embedding/prefill-booking-form-embed
 * @see https://cal.com/docs/atoms/guides/booking-fields (disableOnPrefill on booking fields)
 */

const CAL_API_BASE = process.env.CAL_API_BASE_URL || 'https://api.cal.com';

/**
 * Verifies Cal.com webhook per https://cal.com/docs/developing/guides/automation/webhooks
 * HMAC-SHA256 of raw body; compare to x-cal-signature-256 header.
 */
export function verifyCalWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !signatureHeader) return false;
  const normalized = signatureHeader.replace(/^sha256=/i, '').trim();
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(normalized, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * POST /v2/bookings/{bookingUid}/cancel — Cal.com API v2
 * @see https://cal.com/docs/api-reference/v2/bookings/cancel-a-booking
 */
export async function cancelCalBooking(bookingUid: string, reason: string): Promise<boolean> {
  const key = process.env.CAL_API_KEY;
  if (!key) {
    console.error('CAL_API_KEY is not set; cannot cancel Cal.com booking');
    return false;
  }

  const res = await fetch(`${CAL_API_BASE}/v2/bookings/${encodeURIComponent(bookingUid)}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'cal-api-version': '2026-02-25',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancellationReason: reason }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Cal.com cancel failed (${res.status}):`, text);
    return false;
  }
  return true;
}
