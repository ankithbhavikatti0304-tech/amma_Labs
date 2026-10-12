-- DropIndex
DROP INDEX "User_phone_key";

-- AlterTable
ALTER TABLE "OtpRequest" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "OtpRequest_email_createdAt_idx" ON "OtpRequest"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

