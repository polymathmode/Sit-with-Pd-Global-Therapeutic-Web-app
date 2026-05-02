/**
 * Resend Audiences API (contacts) via HTTPS — same RESEND_API_KEY as outbound mail.
 * @see https://www.resend.com/docs/api-reference/contacts/create-contact
 */

const RESEND_API_BASE = 'https://api.resend.com';

export type ResendContactSyncResult =
  | { ok: true; contactId?: string }
  | { ok: false; message: string };

function getApiKey(): string | null {
  const k = process.env.RESEND_API_KEY?.trim();
  return k || null;
}

function parseNewsletterSegmentIds(): string[] {
  const raw = process.env.RESEND_NEWSLETTER_SEGMENT_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorMessageFromRes(res: Response, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.map(String).join('; ');
  }
  return res.statusText || 'Resend request failed';
}

/**
 * Create contact or set unsubscribed=false on existing. Optionally add to segment(s).
 */
export async function syncNewsletterSignupToResend(email: string): Promise<ResendContactSyncResult> {
  const key = getApiKey();
  if (!key) return { ok: false, message: 'RESEND_API_KEY not configured' };

  const postRes = await fetch(`${RESEND_API_BASE}/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, unsubscribed: false }),
  });

  let contactId: string | undefined;

  if (postRes.ok) {
    const data = (await readJson(postRes)) as { id?: unknown } | null;
    if (data && typeof data.id === 'string') contactId = data.id;
  } else {
    const postErr = await readJson(postRes);
    const patchRes = await fetch(`${RESEND_API_BASE}/contacts/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unsubscribed: false }),
    });

    if (!patchRes.ok) {
      const patchErr = await readJson(patchRes);
      return {
        ok: false,
        message: `${errorMessageFromRes(patchRes, patchErr)} (${postRes.status}→${patchRes.status}: ${errorMessageFromRes(postRes, postErr)})`,
      };
    }

    const patched = (await readJson(patchRes)) as { id?: unknown } | null;
    if (patched && typeof patched.id === 'string') contactId = patched.id;
  }

  const contactPath = encodeURIComponent(email);
  for (const segmentId of parseNewsletterSegmentIds()) {
    const segRes = await fetch(`${RESEND_API_BASE}/contacts/${contactPath}/segments/${segmentId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
    if (!segRes.ok) {
      const segErr = await readJson(segRes);
      if (segRes.status !== 409 && segRes.status !== 422) {
        console.warn(
          '[newsletter/resend] segment add failed:',
          segmentId,
          errorMessageFromRes(segRes, segErr)
        );
      }
    }
  }

  return { ok: true, contactId };
}

/** Mark contact unsubscribed globally in Resend (broadcasts). */
export async function syncNewsletterUnsubscribeToResend(email: string): Promise<ResendContactSyncResult> {
  const key = getApiKey();
  if (!key) return { ok: false, message: 'RESEND_API_KEY not configured' };

  const res = await fetch(`${RESEND_API_BASE}/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ unsubscribed: true }),
  });

  if (res.ok) return { ok: true };
  if (res.status === 404) return { ok: true };

  const body = await readJson(res);
  return { ok: false, message: errorMessageFromRes(res, body) };
}
