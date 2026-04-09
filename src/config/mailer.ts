import nodemailer, { SendMailOptions } from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

/**
 * When EMAIL_DEV_REDIRECT_TO is set and NODE_ENV is not production, all mail is
 * delivered to that address so providers like Resend (single sandbox recipient)
 * still work while the app stores distinct addresses (e.g. user+tag@gmail.com).
 * Verification / reset tokens in the message are unchanged.
 */
export async function sendMail(options: SendMailOptions) {
  const redirectRaw = process.env.EMAIL_DEV_REDIRECT_TO?.trim();
  const redirect =
    process.env.NODE_ENV !== 'production' && redirectRaw ? redirectRaw : undefined;

  if (!redirect || !options.to) {
    return transporter.sendMail(options);
  }

  const intended = recipientPreview(options.to);
  if (!intended || intended.toLowerCase() === redirect.toLowerCase()) {
    return transporter.sendMail(options);
  }

  const headers = {
    ...((options.headers as Record<string, string>) || {}),
    'X-Originally-To': intended,
  };

  return transporter.sendMail({
    ...options,
    to: redirect,
    headers,
  });
}

export default transporter;
