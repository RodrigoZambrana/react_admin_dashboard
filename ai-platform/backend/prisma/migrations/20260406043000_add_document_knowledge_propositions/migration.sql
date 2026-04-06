-- CreateEnum
CREATE TYPE "DocumentKnowledgeEvidenceTier" AS ENUM ('TYPED_CLAIM', 'NORMALIZED_PROPOSITION', 'EXCERPT_ONLY');

-- CreateEnum
CREATE TYPE "DocumentKnowledgePolarity" AS ENUM ('AFFIRMED', 'NEGATED', 'CONDITIONAL', 'COMPARATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocumentKnowledgePromotionState" AS ENUM ('UNCLASSIFIED', 'CANDIDATE', 'PROMOTED', 'REJECTED');

-- CreateTable
CREATE TABLE "DocumentKnowledgeProposition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "layer" TEXT,
    "extractionScope" TEXT,
    "profileKey" TEXT,
    "subjectAxis" TEXT,
    "subjectValue" TEXT,
    "subjectNormalized" TEXT,
    "predicate" TEXT NOT NULL,
    "facet" TEXT,
    "objectValue" TEXT NOT NULL,
    "objectNormalized" TEXT,
    "polarity" "DocumentKnowledgePolarity" NOT NULL,
    "supportClass" "DocumentKnowledgeSupportClass" NOT NULL,
    "evidenceTier" "DocumentKnowledgeEvidenceTier" NOT NULL DEFAULT 'NORMALIZED_PROPOSITION',
    "confidence" DOUBLE PRECISION NOT NULL,
    "relationScope" JSONB,
    "canonicalKey" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "evidenceTextSpan" TEXT NOT NULL,
    "metadata" JSONB,
    "promotionState" "DocumentKnowledgePromotionState" NOT NULL DEFAULT 'UNCLASSIFIED',
    "promotedAxis" TEXT,
    "promotedFacet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentKnowledgeProposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentKnowledgeProposition_tenantId_documentId_chunkId_sequence_idx" ON "DocumentKnowledgeProposition"("tenantId", "documentId", "chunkId", "sequence");

-- CreateIndex
CREATE INDEX "DocumentKnowledgeProposition_tenantId_predicate_facet_idx" ON "DocumentKnowledgeProposition"("tenantId", "predicate", "facet");

-- CreateIndex
CREATE INDEX "DocumentKnowledgeProposition_tenantId_patternKey_idx" ON "DocumentKnowledgeProposition"("tenantId", "patternKey");

-- CreateIndex
CREATE INDEX "DocumentKnowledgeProposition_tenantId_promotionState_updatedAt_idx" ON "DocumentKnowledgeProposition"("tenantId", "promotionState", "updatedAt");

-- AddForeignKey
ALTER TABLE "DocumentKnowledgeProposition" ADD CONSTRAINT "DocumentKnowledgeProposition_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentKnowledgeProposition" ADD CONSTRAINT "DocumentKnowledgeProposition_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
