import crypto from 'crypto';

/**
 * Frontend: prefill the logged-in user’s email in the Cal embed `config` and enable
 * “Disable on Prefill” for the email field on the event type so it cannot be edited.
 * @see https://cal.com/help/embedding/prefill-booking-form-embed
 * @see https://cal.com/docs/atoms/guides/booking-fields (disableOnPrefill on booking fields)
 */

const CAL_API_BASE = process.env.CAL_API_BASE_URL || 'https://api.cal.com';

/** @see https://cal.com/docs/api-reference/v2/event-types/get-all-event-types */
const CAL_API_VERSION_EVENT_TYPES = '2024-06-14';

export type CalEventTypeListItem = {
  calEventTypeId: number;
  title: string;
  slug: string;
  lengthInMinutes: number;
  calBookingUrl: string;
  username: string | null;
};

/**
 * Lists event types for the authenticated Cal.com account (API key).
 * Optional `username` scopes results to that Cal username (see Cal API docs).
 */
export async function fetchCalEventTypesList(params: { username?: string }): Promise<CalEventTypeListItem[]> {
  const key = process.env.CAL_API_KEY;
  if (!key) {
    throw new Error('CAL_API_KEY is not configured');
  }

  const url = new URL(`${CAL_API_BASE}/v2/event-types`);
  if (params.username) {
    url.searchParams.set('username', params.username);
  }
  url.searchParams.set('sortCreatedAt', 'asc');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'cal-api-version': CAL_API_VERSION_EVENT_TYPES,
    },
  });

  const rawText = await res.text();
  let json: { status?: string; data?: Array<Record<string, unknown>>; message?: string };
  try {
    json = JSON.parse(rawText) as typeof json;
  } catch {
    throw new Error(`Cal.com API returned non-JSON (${res.status})`);
  }

  if (!res.ok) {
    const detail = json.message || rawText.slice(0, 500);
    throw new Error(`Cal.com API error (${res.status}): ${detail || res.statusText}`);
  }

  if (json.status !== 'success' || !Array.isArray(json.data)) {
    throw new Error('Unexpected response from Cal.com event-types API');
  }

  return json.data.map((item) => {
    const id = item.id;
    const title = item.title;
    const slug = item.slug;
    const lengthInMinutes = item.lengthInMinutes;
    const bookingUrl = item.bookingUrl;
    if (typeof id !== 'number' || typeof title !== 'string' || typeof slug !== 'string') {
      throw new Error('Invalid event type entry from Cal.com API');
    }
    const len = typeof lengthInMinutes === 'number' ? lengthInMinutes : 0;
    const users = item.users as Array<{ username?: string | null }> | undefined;
    const username = users?.[0]?.username ?? null;
    let calBookingUrl =
      typeof bookingUrl === 'string' && bookingUrl.trim() !== '' ? bookingUrl.trim() : '';
    if (!calBookingUrl && username) {
      calBookingUrl = `https://cal.com/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
    }
    return {
      calEventTypeId: id,
      title,
      slug,
      lengthInMinutes: len,
      calBookingUrl,
      username,
    };
  });
}

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
