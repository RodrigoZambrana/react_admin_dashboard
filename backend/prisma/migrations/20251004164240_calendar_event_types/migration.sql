-- AlterTable
ALTER TABLE "public"."CalendarEvent" ADD COLUMN     "eventTypeId" INTEGER;

-- CreateTable
CREATE TABLE "public"."CalendarEventType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventType_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."CalendarEventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
