ALTER TABLE "public"."Order"
    ADD COLUMN IF NOT EXISTS "documentFilePath" TEXT,
    ADD COLUMN IF NOT EXISTS "documentFileName" TEXT,
    ADD COLUMN IF NOT EXISTS "documentFileMime" TEXT,
    ADD COLUMN IF NOT EXISTS "documentFileSize" INTEGER,
    ADD COLUMN IF NOT EXISTS "documentGeneratedAt" TIMESTAMP(3);
