-- CreateEnum
CREATE TYPE "ManagedResourceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "PromptVersion"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "ManagedResourceStatus"
USING ("status"::text::"ManagedResourceStatus"),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "TemporalLocaleVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ManagedResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "resource" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "TemporalLocaleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemporalLocaleVersion_tenantId_locale_version_key" ON "TemporalLocaleVersion"("tenantId", "locale", "version");

-- CreateIndex
CREATE INDEX "TemporalLocaleVersion_tenantId_locale_status_idx" ON "TemporalLocaleVersion"("tenantId", "locale", "status");

-- DropEnum
DROP TYPE "PromptStatus";
