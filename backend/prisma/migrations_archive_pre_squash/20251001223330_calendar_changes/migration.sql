-- AlterTable
ALTER TABLE "public"."CalendarEvent" ADD COLUMN     "color" VARCHAR(32),
ADD COLUMN     "metadata" JSONB;
