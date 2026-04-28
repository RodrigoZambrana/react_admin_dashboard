-- Centralized seedable settings table for environment-specific configuration snapshots.
CREATE TABLE "Setting" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "environment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "setting_key_environment_unique"
  ON "Setting"("key", "environment");

CREATE INDEX "setting_environment_idx"
  ON "Setting"("environment");
