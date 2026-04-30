import prisma from '../config/prisma';

export const PLATFORM_SETTINGS_ID = 'default';

/** Ensures the singleton platform_settings row exists (id `default`). */
export async function ensurePlatformSettings() {
  const existing = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });
  if (existing) return existing;
  return prisma.platformSettings.create({
    data: { id: PLATFORM_SETTINGS_ID },
  });
}
