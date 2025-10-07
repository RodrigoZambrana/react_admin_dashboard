-- CreateTable
CREATE TABLE "CalendarEventComment" (
    "id" SERIAL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEventComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEventComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AddIndex
CREATE INDEX "CalendarEventComment_eventId_idx" ON "CalendarEventComment"("eventId");
