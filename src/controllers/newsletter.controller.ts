import { Request, Response } from 'express';
import { buildMeta, parseAdminPagination } from '../lib/pagination';
import { catchAsync, AppError } from '../middleware/error.middleware';
import {
  NEWSLETTER_ADMIN_SEARCH_MAX_LEN,
  listNewsletterSubscriptionsAdmin,
  subscribeNewsletter,
  unsubscribeNewsletterByToken,
} from '../services/newsletter.service';

function clientBaseUrl(): string {
  return (process.env.CLIENT_URL?.replace(/\/+$/, '') || 'http://localhost:3000').trim();
}

function wantsJsonResponse(req: Request): boolean {
  if (req.query.format === 'json') return true;
  const accept = req.get('Accept') || '';
  return accept.includes('application/json');
}

export const subscribe = catchAsync(async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim();
  const source = req.body.source;

  const result = await subscribeNewsletter(email, typeof source === 'string' ? source : undefined);

  if (result.resendError) {
    console.warn('[newsletter] Resend sync failed:', result.resendError);
  }

  const payload = {
    success: true,
    message: result.alreadySubscribed
      ? 'You are already subscribed to our newsletter.'
      : 'Thanks for subscribing!',
    data: {
      alreadySubscribed: result.alreadySubscribed,
      resendSynced: result.resendSynced,
    },
  };

  res.status(result.alreadySubscribed ? 200 : 201).json(payload);
});

export const unsubscribe = catchAsync(async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  const base = clientBaseUrl();
  const redirect = (path: string) => res.redirect(302, `${base}${path}`);
  const json = wantsJsonResponse(req);

  if (!token) {
    if (json) throw new AppError('Unsubscribe token is required.', 400);
    return redirect('/?newsletter=unsubscribe_invalid');
  }

  const outcome = await unsubscribeNewsletterByToken(token);

  if (outcome.status === 'invalid') {
    if (json) throw new AppError('Invalid or expired unsubscribe link.', 404);
    return redirect('/?newsletter=unsubscribe_invalid');
  }

  if (outcome.status === 'already') {
    if (json) {
      return res.json({ success: true, message: 'You were already unsubscribed.' });
    }
    return redirect('/?newsletter=unsubscribe_already');
  }

  if (json) {
    return res.json({
      success: true,
      message: 'You have been unsubscribed.',
      data: { resendSynced: outcome.resendSynced },
    });
  }

  return redirect(outcome.resendSynced ? '/?newsletter=unsubscribed' : '/?newsletter=unsubscribed_local');
});

function parseNewsletterAdminFilter(req: Request): 'all' | 'active' | 'unsubscribed' {
  const raw = String(req.query.status ?? 'all')
    .trim()
    .toLowerCase();
  if (raw === '' || raw === 'all') return 'all';
  if (raw === 'active') return 'active';
  if (raw === 'unsubscribed') return 'unsubscribed';
  throw new AppError('Invalid status. Use all, active, or unsubscribed.', 400);
}

/**
 * GET /api/admin/newsletter/subscriptions
 * Pagination + optional search (email/source) + optional status filter.
 */
export const adminListNewsletterSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const { skip, page, limit } = parseAdminPagination(req);
  const filter = parseNewsletterAdminFilter(req);
  const rawSearch = req.query.search;
  const search =
    typeof rawSearch === 'string'
      ? rawSearch.trim().slice(0, NEWSLETTER_ADMIN_SEARCH_MAX_LEN)
      : '';

  const { rows, total } = await listNewsletterSubscriptionsAdmin({
    skip,
    take: limit,
    search,
    filter,
  });

  res.json({
    success: true,
    message: 'Newsletter subscriptions fetched.',
    data: rows,
    meta: buildMeta(total, page, limit),
  });
});
