-- CreateEnum
CREATE TYPE "PlatformCurrency" AS ENUM ('NGN', 'USD', 'EUR', 'GBP');

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "platformName" TEXT NOT NULL DEFAULT 'Sit With PD',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@sitwithpd.com',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "currency" "PlatformCurrency" NOT NULL DEFAULT 'NGN',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "allowUserRegistration" BOOLEAN NOT NULL DEFAULT true,
    "requireEmailVerification" BOOLEAN NOT NULL DEFAULT true,
    "autoEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id") VALUES ('default');
