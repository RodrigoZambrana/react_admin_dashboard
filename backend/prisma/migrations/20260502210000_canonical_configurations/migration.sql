ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "productCapabilities" JSONB,
  ADD COLUMN IF NOT EXISTS "productConfigSchema" JSONB;

CREATE TABLE IF NOT EXISTS "CanonicalConfiguration" (
  "id" SERIAL NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'global',
  "baseProductId" INTEGER NOT NULL,
  "configurationRules" JSONB NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "baseLabel" TEXT,
  "slug" TEXT NOT NULL,
  "indexable" BOOLEAN NOT NULL DEFAULT TRUE,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "searchTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "visibilityRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CanonicalConfiguration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CanonicalConfiguration_baseProductId_fkey"
    FOREIGN KEY ("baseProductId")
    REFERENCES "Product"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanonicalConfiguration_tenantId_slug_key"
  ON "CanonicalConfiguration"("tenantId", "slug");

CREATE INDEX IF NOT EXISTS "CanonicalConfiguration_baseProductId_indexable_idx"
  ON "CanonicalConfiguration"("baseProductId", "indexable");

CREATE INDEX IF NOT EXISTS "CanonicalConfiguration_tenantId_indexable_idx"
  ON "CanonicalConfiguration"("tenantId", "indexable");
