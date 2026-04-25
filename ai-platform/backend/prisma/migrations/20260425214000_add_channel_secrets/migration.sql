CREATE TABLE "ChannelSecret" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT,
  "lastFour" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelSecret_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelSecret_tenantId_key_key" ON "ChannelSecret"("tenantId", "key");
CREATE INDEX "ChannelSecret_tenantId_updatedAt_idx" ON "ChannelSecret"("tenantId", "updatedAt");
