-- Add optional comments field for order items
ALTER TABLE "public"."OrderItem" ADD COLUMN "comments" TEXT;
