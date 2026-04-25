-- CreateTable
CREATE TABLE "ChannelConnectionState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "connectionState" TEXT NOT NULL,
    "health" TEXT NOT NULL,
    "summary" TEXT,
    "capabilities" JSONB,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnectionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnectionState_tenantId_channelKey_key" ON "ChannelConnectionState"("tenantId", "channelKey");

-- CreateIndex
CREATE INDEX "ChannelConnectionState_tenantId_driver_observedAt_idx" ON "ChannelConnectionState"("tenantId", "driver", "observedAt");
