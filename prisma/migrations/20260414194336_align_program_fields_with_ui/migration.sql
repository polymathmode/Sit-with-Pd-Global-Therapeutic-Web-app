-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "learningObjectives" TEXT[];

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "facilitatorEmail" TEXT,
ADD COLUMN     "facilitatorName" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);
