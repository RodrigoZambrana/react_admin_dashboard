-- Add metadata for order and budget analysis payloads
ALTER TABLE "Order" ADD COLUMN "metadata" JSONB;
