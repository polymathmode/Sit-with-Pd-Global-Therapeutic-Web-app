import nodemailer, { SendMailOptions } from 'nodemailer';
import { Resend } from 'resend';
import prisma from './prisma';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter {
  if (smtpTransporter) return smtpTransporter;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    throw new Error(
      'Email is not configured: set RESEND_API_KEY (recommended on Render) or SMTP_HOST and related SMTP variables.'
    );
  }
  smtpTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return smtpTransporter;
}

function recipientPreview(to: SendMailOptions['to']): string {
  if (to == null) return '';
  if (typeof to === 'string') return to;
  if (Array.isArray(to)) {
    return to
      .map((entry) => (typeof entry === 'string' ? entry : (entry as { address?: string }).address ?? ''))
      .filter(Boolean)
      .join(', ');
  }
  return (to as { address?: string }).address ?? '';
}

function formatMailFrom(from: SendMailOptions['from']): string {
  if (from == null) {
    throw new Error('Email "from" is required');
  }
  if (typeof from === 'string') return from;
  const o = from as { name?: string; address: string };
  if (o.name) return `"${o.name}" <${o.address}>`;
  return o.address;
}

function recipientsForResend(to: SendMailOptions['to']): string | string[] {
  if (to == null) {
    throw new Error('Email "to" is required');
  }
  if (typeof to === 'string') return to;
  if (Array.isArray(to)) {
    const list = to
      .map((entry) => (typeof entry === 'string' ? entry : (entry as { address?: string }).address ?? ''))
      .filter(Boolean);
    if (list.length === 0) throw new Error('No recipient addresses');
    return list.length === 1 ? list[0]! : list;
  }
  const addr = (to as { address?: string }).address;
  if (!addr) throw new Error('No recipient address');
  return addr;
}

function htmlOrText(options: SendMailOptions): string {
  const { html, text } = options;
  if (typeof html === 'string') return html;
  if (Buffer.isBuffer(html)) return html.toString('utf8');
  if (html != null) return String(html);
  if (typeof text === 'string') return text;
  throw new Error('Email must include html or text body');
}

async function sendViaResend(options: SendMailOptions) {
  const resend = getResend()!;
  const { data, error } = await resend.emails.send({
    from: formatMailFrom(options.from),
    to: recipientsForResend(options.to),
    subject: options.subject ?? '',
    html: htmlOrText(options),
    headers:
      options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)
        ? (options.headers as Record<string, string>)
        : undefined,
    replyTo: options.replyTo as string | string[] | undefined,
    cc: options.cc as string | string[] | undefined,
    bcc: options.bcc as string | string[] | undefined,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

/** When admin disables platform emails, outbound transactional mail is skipped (logged). */
async function platformEmailsEnabled(): Promise<boolean> {
  try {
    const row = await prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { emailNotificationsEnabled: true },
    });
    return row?.emailNotificationsEnabled ?? true;
  } catch {
    return true;
  }
}

/**
 * When EMAIL_DEV_REDIRECT_TO is set:
 * - In non-production, all mail is delivered to that address (Resend sandbox, etc.).
 * - In production, same behavior only if EMAIL_REDIRECT_IN_PRODUCTION=true (explicit opt-in).
 * Distinct signup addresses (e.g. user+tag@gmail.com) stay in DB; only delivery is redirected.
 * Headers include X-Originally-To; verification/reset tokens in the body are unchanged.
 */
export async function sendMail(options: SendMailOptions) {
  const emailsOn = await platformEmailsEnabled();
  if (!emailsOn) {
    console.warn('[mail] Skipped (platform emailNotificationsEnabled=false):', options.subject ?? '');
    return undefined;
  }

  const redirectRaw = process.env.EMAIL_DEV_REDIRECT_TO?.trim();
  const allowRedirect =
    redirectRaw &&
    (process.env.NODE_ENV !== 'production' || envFlagTrue(process.env.EMAIL_REDIRECT_IN_PRODUCTION));
  const redirect = allowRedirect ? redirectRaw : undefined;

  let payload = options;

  if (redirect && options.to) {
    const intended = recipientPreview(options.to);
    if (intended && intended.toLowerCase() !== redirect.toLowerCase()) {
      payload = {
        ...options,
        to: redirect,
        headers: {
          ...((options.headers as Record<string, string>) || {}),
          'X-Originally-To': intended,
        },
      };
    }
  }

  if (getResend()) {
    return sendViaResend(payload);
  }

  return getSmtpTransporter().sendMail(payload);
}
