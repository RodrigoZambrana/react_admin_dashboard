-- Add optional comments field for customer addresses
ALTER TABLE "public"."CustomerAddress" ADD COLUMN "comments" TEXT;

-- Ensure customer email is unique
CREATE UNIQUE INDEX "Customer_email_key" ON "public"."Customer"("email");

-- Ensure customer phone number is unique
CREATE UNIQUE INDEX "Customer_phoneNumber_key" ON "public"."Customer"("phoneNumber");
