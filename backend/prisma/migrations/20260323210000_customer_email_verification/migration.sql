-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerEmailVerificationToken" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEmailVerificationToken_tokenHash_key" ON "CustomerEmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerEmailVerificationToken_customerId_idx" ON "CustomerEmailVerificationToken"("customerId");

-- CreateIndex
CREATE INDEX "CustomerEmailVerificationToken_expiresAt_idx" ON "CustomerEmailVerificationToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "CustomerEmailVerificationToken" ADD CONSTRAINT "CustomerEmailVerificationToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
