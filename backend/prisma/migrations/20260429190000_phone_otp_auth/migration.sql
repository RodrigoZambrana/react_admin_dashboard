-- Auth hardening for phone-based registration, verification and recovery.

CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED');
CREATE TYPE "OtpCodeType" AS ENUM ('VERIFICATION', 'RECOVERY');
CREATE TYPE "SecurityEventType" AS ENUM (
  'OTP_SENT',
  'OTP_VERIFIED',
  'OTP_FAILED',
  'ACCOUNT_REGISTERED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PROVIDER_FAILURE'
);

ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

CREATE TABLE "otp_codes" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "codeHash" TEXT NOT NULL,
  "type" "OtpCodeType" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "target" TEXT,
  "channel" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "otp_codes_userId_type_createdAt_idx" ON "otp_codes"("userId", "type", "createdAt");
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");
CREATE INDEX "otp_codes_target_idx" ON "otp_codes"("target");

CREATE TABLE "security_events" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER,
  "eventType" "SecurityEventType" NOT NULL,
  "channel" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");
CREATE INDEX "security_events_eventType_createdAt_idx" ON "security_events"("eventType", "createdAt");
