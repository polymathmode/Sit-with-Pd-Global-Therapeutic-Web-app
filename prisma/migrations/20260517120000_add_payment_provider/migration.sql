-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYSTACK';
