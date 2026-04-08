import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export function getGoogleClientIds(): string[] {
  const raw = process.env.GOOGLE_CLIENT_ID;
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const audience = getGoogleClientIds();
  if (audience.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  if (payload.email_verified !== true) {
    throw new Error('Google email not verified');
  }

  const email = payload.email.toLowerCase();
  const firstName =
    payload.given_name?.trim() ||
    payload.name?.trim()?.split(/\s+/)[0] ||
    'User';
  const lastName =
    payload.family_name?.trim() ||
    payload.name?.trim()?.split(/\s+/).slice(1).join(' ') ||
    'Member';

  return {
    googleId: payload.sub,
    email,
    firstName,
    lastName,
  };
}
