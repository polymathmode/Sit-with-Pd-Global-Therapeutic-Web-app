-- AlterTable: camps — add benefits, currency, and make price optional
ALTER TABLE "camps" ALTER COLUMN "price" DROP NOT NULL;
ALTER TABLE "camps" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "camps" ADD COLUMN "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: camp_registrations — add tier, participant count, applicant details
ALTER TABLE "camp_registrations" ADD COLUMN "tierId" TEXT;
ALTER TABLE "camp_registrations" ADD COLUMN "participantCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "camp_registrations" ADD COLUMN "applicantDetails" JSONB;

-- CreateTable: camp_tiers
CREATE TABLE "camp_tiers" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seatsPerUnit" INTEGER NOT NULL DEFAULT 1,
    "maxUnits" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: camp_images
CREATE TABLE "camp_images" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camp_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable: testimonials
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "campId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "quote" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "camp_tiers" ADD CONSTRAINT "camp_tiers_campId_fkey" FOREIGN KEY ("campId") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_images" ADD CONSTRAINT "camp_images_campId_fkey" FOREIGN KEY ("campId") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_campId_fkey" FOREIGN KEY ("campId") REFERENCES "camps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_registrations" ADD CONSTRAINT "camp_registrations_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "camp_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
