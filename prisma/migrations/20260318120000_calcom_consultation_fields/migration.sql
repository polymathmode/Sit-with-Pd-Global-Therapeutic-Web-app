-- AlterEnum: add PENDING_PAYMENT (PostgreSQL)
ALTER TYPE "ConsultationStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "consultation_services" ADD COLUMN "calEventTypeId" INTEGER;

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN "calBookingId" TEXT,
ADD COLUMN "calBookingUrl" TEXT,
ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "consultations_calBookingId_key" ON "consultations"("calBookingId");
