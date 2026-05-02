-- Restore the environment-scoped Setting table required by the global seed.
CREATE TABLE IF NOT EXISTS "Setting" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "environment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "setting_key_environment_unique"
  ON "Setting"("key", "environment");

CREATE INDEX IF NOT EXISTS "setting_environment_idx"
  ON "Setting"("environment");
