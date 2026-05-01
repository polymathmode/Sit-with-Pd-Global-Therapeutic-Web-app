-- DropForeignKey
ALTER TABLE "camp_registrations" DROP CONSTRAINT "camp_registrations_campId_fkey";

-- AddForeignKey
ALTER TABLE "camp_registrations" ADD CONSTRAINT "camp_registrations_campId_fkey" FOREIGN KEY ("campId") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
