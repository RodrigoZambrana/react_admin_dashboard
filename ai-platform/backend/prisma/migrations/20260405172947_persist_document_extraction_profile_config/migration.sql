-- CreateEnum
CREATE TYPE "DocumentExtractionProfileConfigSource" AS ENUM ('TENANT_DERIVED');

-- CreateTable
CREATE TABLE "DocumentExtractionProfileConfigRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "sourceKind" "DocumentExtractionProfileConfigSource" NOT NULL DEFAULT 'TENANT_DERIVED',
    "hints" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtractionProfileConfigRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentExtractionProfileConfigRecord_tenantId_profileId_lo_idx" ON "DocumentExtractionProfileConfigRecord"("tenantId", "profileId", "locale", "updatedAt");

-- CreateIndex
CREATE INDEX "DocumentExtractionProfileConfigRecord_tenantId_documentId_u_idx" ON "DocumentExtractionProfileConfigRecord"("tenantId", "documentId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtractionProfileConfigRecord_documentId_profileId__key" ON "DocumentExtractionProfileConfigRecord"("documentId", "profileId", "locale");

-- AddForeignKey
ALTER TABLE "DocumentExtractionProfileConfigRecord" ADD CONSTRAINT "DocumentExtractionProfileConfigRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
