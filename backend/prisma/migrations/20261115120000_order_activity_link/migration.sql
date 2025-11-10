ALTER TABLE "public"."Order"
    ADD COLUMN "activityId" INTEGER;

CREATE INDEX IF NOT EXISTS "Order_activityId_idx"
    ON "public"."Order"("activityId");

ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "public"."CalendarEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
