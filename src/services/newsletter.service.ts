import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import {
  syncNewsletterSignupToResend,
  syncNewsletterUnsubscribeToResend,
} from './resendAudience.service';

export const NEWSLETTER_ADMIN_SEARCH_MAX_LEN = 100;

function newUnsubscribeToken(): string {
  return randomBytes(24).toString('hex');
}

export type SubscribeNewsletterResult =
  | {
      alreadySubscribed: true;
      resendSynced: boolean;
      resendError?: string;
    }
  | {
      alreadySubscribed: false;
      resendSynced: boolean;
      resendError?: string;
    };

export async function subscribeNewsletter(
  email: string,
  source?: string
): Promise<SubscribeNewsletterResult> {
  const src = (source?.trim() || 'footer').slice(0, 120);

  const existing = await prisma.newsletterSubscription.findUnique({ where: { email } });

  if (existing && !existing.unsubscribedAt) {
    const sync = await syncNewsletterSignupToResend(email);
    await prisma.newsletterSubscription.update({
      where: { email },
      data: {
        ...(sync.ok
          ? {
              resendSyncedAt: new Date(),
              resendLastError: null,
              ...(sync.contactId ? { resendContactId: sync.contactId } : {}),
            }
          : {
              resendLastError: sync.message,
            }),
      },
    });
    return {
      alreadySubscribed: true,
      resendSynced: sync.ok,
      resendError: sync.ok ? undefined : sync.message,
    };
  }

  let recordId: string;

  if (existing?.unsubscribedAt) {
    const row = await prisma.newsletterSubscription.update({
      where: { email },
      data: {
        unsubscribedAt: null,
        unsubscribeToken: newUnsubscribeToken(),
        subscribedAt: new Date(),
        source: src,
      },
    });
    recordId = row.id;
  } else {
    const row = await prisma.newsletterSubscription.create({
      data: {
        email,
        unsubscribeToken: newUnsubscribeToken(),
        source: src,
      },
    });
    recordId = row.id;
  }

  const sync = await syncNewsletterSignupToResend(email);
  await prisma.newsletterSubscription.update({
    where: { id: recordId },
    data: {
      ...(sync.ok ? { resendSyncedAt: new Date() } : {}),
      ...(sync.ok && sync.contactId ? { resendContactId: sync.contactId } : {}),
      resendLastError: sync.ok ? null : sync.message,
    },
  });

  return {
    alreadySubscribed: false,
    resendSynced: sync.ok,
    resendError: sync.ok ? undefined : sync.message,
  };
}

export async function unsubscribeNewsletterByToken(token: string): Promise<
  | { status: 'invalid' }
  | { status: 'already' }
  | { status: 'ok'; resendSynced: boolean }
> {
  const sub = await prisma.newsletterSubscription.findUnique({
    where: { unsubscribeToken: token },
  });

  if (!sub) return { status: 'invalid' };
  if (sub.unsubscribedAt) return { status: 'already' };

  await prisma.newsletterSubscription.update({
    where: { id: sub.id },
    data: { unsubscribedAt: new Date() },
  });

  const resend = await syncNewsletterUnsubscribeToResend(sub.email);

  return { status: 'ok', resendSynced: resend.ok };
}

export type NewsletterAdminFilter = 'all' | 'active' | 'unsubscribed';

export async function listNewsletterSubscriptionsAdmin(params: {
  skip: number;
  take: number;
  search: string;
  filter: NewsletterAdminFilter;
}) {
  const { skip, take, search, filter } = params;

  const where: Prisma.NewsletterSubscriptionWhereInput = {
    ...(filter === 'active' ? { unsubscribedAt: null } : {}),
    ...(filter === 'unsubscribed' ? { NOT: { unsubscribedAt: null } } : {}),
    ...(search.length > 0
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { source: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.newsletterSubscription.findMany({
      where,
      select: {
        id: true,
        email: true,
        source: true,
        subscribedAt: true,
        unsubscribedAt: true,
        resendContactId: true,
        resendSyncedAt: true,
        resendLastError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { subscribedAt: 'desc' },
      skip,
      take,
    }),
    prisma.newsletterSubscription.count({ where }),
  ]);

  return { rows, total };
}
