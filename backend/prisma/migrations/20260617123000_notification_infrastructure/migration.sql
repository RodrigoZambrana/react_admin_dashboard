-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('ORDER_RECEIVED', 'PAYMENT_RECEIVED', 'ORDER_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'OPS';
ALTER TYPE "Role" ADD VALUE 'SALES';
ALTER TYPE "Role" ADD VALUE 'FINANCE';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "audience" "NotificationAudience",
ADD COLUMN     "body" TEXT,
ADD COLUMN     "channel" "NotificationChannel",
ADD COLUMN     "customerId" INTEGER,
ADD COLUMN     "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "eventType" "NotificationEventType",
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "orderId" INTEGER,
ADD COLUMN     "paymentId" INTEGER,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" SERIAL NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateKey" TEXT,
    "localeOverrides" JSONB,
    "emailSubject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOAuthAccount" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "givenName" TEXT,
    "familyName" TEXT,
    "picture" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "CustomerOAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontOAuthSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "returnPath" TEXT,
    "scopes" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "StorefrontOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_event_channel_unique" ON "NotificationSetting"("eventType", "audience", "channel");

-- CreateIndex
CREATE INDEX "CustomerOAuthAccount_customerId_idx" ON "CustomerOAuthAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOAuthAccount_provider_providerAccountId_key" ON "CustomerOAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontOAuthSession_state_key" ON "StorefrontOAuthSession"("state");

-- CreateIndex
CREATE INDEX "StorefrontOAuthSession_expiresAt_idx" ON "StorefrontOAuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_idempotency_key_unique" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notification_recipient_read_at_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "notification_customer_read_at_idx" ON "Notification"("customerId", "readAt");

-- CreateIndex
CREATE INDEX "notification_event_audience_channel_idx" ON "Notification"("eventType", "audience", "channel");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOAuthAccount" ADD CONSTRAINT "CustomerOAuthAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

