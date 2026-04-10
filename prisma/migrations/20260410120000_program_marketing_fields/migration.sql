-- CreateEnum
CREATE TYPE "ProgramDeliveryFormat" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "summary" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "durationWeeks" INTEGER,
ADD COLUMN     "hoursPerWeek" DOUBLE PRECISION,
ADD COLUMN     "deliveryFormat" "ProgramDeliveryFormat" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "certificateLabel" TEXT,
ADD COLUMN     "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[];
