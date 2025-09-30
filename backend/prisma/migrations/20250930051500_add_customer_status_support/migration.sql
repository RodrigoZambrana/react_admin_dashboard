-- Ensure the customer status column exists
ALTER TABLE "public"."Customer"
    ADD COLUMN IF NOT EXISTS "statusId" INTEGER;

-- Ensure the foreign key is present (idempotent)
DO $$
BEGIN
    ALTER TABLE "public"."Customer"
        ADD CONSTRAINT "Customer_statusId_fkey"
        FOREIGN KEY ("statusId")
        REFERENCES "public"."CustomerStatus" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
