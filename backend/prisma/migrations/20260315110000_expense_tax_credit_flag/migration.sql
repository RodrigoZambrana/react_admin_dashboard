-- AlterTable
ALTER TABLE "public"."Expense"
ADD COLUMN     "taxCreditEligible" BOOLEAN NOT NULL DEFAULT true;

-- Ensure existing expenses default to generating tax credit
UPDATE "public"."Expense"
SET "taxCreditEligible" = true
WHERE "taxCreditEligible" IS NULL;
