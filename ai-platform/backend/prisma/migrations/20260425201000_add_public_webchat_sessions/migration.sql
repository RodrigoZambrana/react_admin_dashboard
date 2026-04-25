-- CreateTable
CREATE TABLE "PublicWebchatSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "authenticated" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "email" TEXT,
    "locale" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "page" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicWebchatSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebchatSession_conversationId_key" ON "PublicWebchatSession"("conversationId");

-- CreateIndex
CREATE INDEX "PublicWebchatSession_tenantId_guestId_updatedAt_idx" ON "PublicWebchatSession"("tenantId", "guestId", "updatedAt");

-- AddForeignKey
ALTER TABLE "PublicWebchatSession" ADD CONSTRAINT "PublicWebchatSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
