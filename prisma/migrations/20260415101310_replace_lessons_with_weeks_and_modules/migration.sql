/*
  Warnings:

  - You are about to drop the column `deliveryFormat` on the `programs` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `programs` table. All the data in the column will be lost.
  - The `category` column on the `programs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `lessons` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('VIDEO', 'READING', 'QUIZ', 'ASSIGNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProgramCategory" AS ENUM ('LEADERS', 'STUDENTS', 'PROFESSIONALS');

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_programId_fkey";

-- AlterTable
ALTER TABLE "programs" DROP COLUMN "deliveryFormat",
DROP COLUMN "summary",
DROP COLUMN "category",
ADD COLUMN     "category" "ProgramCategory" NOT NULL DEFAULT 'LEADERS';

-- DropTable
DROP TABLE "lessons";

-- DropEnum
DROP TYPE "ProgramDeliveryFormat";

-- CreateTable
CREATE TABLE "program_weeks" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learningObjectives" TEXT[],
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_modules" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ModuleType" NOT NULL DEFAULT 'OTHER',
    "duration" TEXT,
    "contentUrl" TEXT,
    "embedCode" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_modules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "program_weeks" ADD CONSTRAINT "program_weeks_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_modules" ADD CONSTRAINT "program_modules_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "program_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
