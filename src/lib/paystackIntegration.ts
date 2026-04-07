const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE = 'https://api.paystack.co';

/**
 * Global integration setting — affects all Paystack checkout sessions.
 * https://paystack.com/docs/api/integration/#update-payment-session-timeout
 * Enable with PAYSTACK_SYNC_PAYMENT_SESSION_TIMEOUT=true (e.g. production) so link expiry aligns with consultation 1h hold.
 */
export async function syncPaystackPaymentSessionTimeoutIfEnabled(): Promise<void> {
  if (process.env.PAYSTACK_SYNC_PAYMENT_SESSION_TIMEOUT !== 'true') return;
  if (!PAYSTACK_SECRET) {
    console.warn('[paystack] PAYSTACK_SECRET_KEY missing; skip payment_session_timeout sync');
    return;
  }
  const seconds = parseInt(process.env.PAYSTACK_PAYMENT_SESSION_TIMEOUT_SECONDS || '3600', 10);
  const res = await fetch(`${PAYSTACK_BASE}/integration/payment_session_timeout`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ timeout: seconds }),
  });
  const j = (await res.json()) as { status?: boolean; message?: string };
  if (!j.status) {
    console.warn('[paystack] payment_session_timeout sync failed:', j.message ?? res.status);
  } else {
    console.log(`[paystack] payment_session_timeout set to ${seconds}s`);
  }
}
