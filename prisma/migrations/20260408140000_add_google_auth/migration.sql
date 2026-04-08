-- AlterTable: allow OAuth users without a local password
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
