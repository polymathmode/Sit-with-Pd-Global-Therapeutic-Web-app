-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT,
ADD COLUMN "timezone" TEXT,
ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyProgramReminders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notifyPush" BOOLEAN NOT NULL DEFAULT true;
