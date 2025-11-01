-- Create enums for customer security flows
CREATE TYPE "CustomerSecurityEventType" AS ENUM (
    'PASSWORD_RESET_REQUEST',
    'PASSWORD_RESET_COMPLETED',
    'PASSWORD_RESET_FAILED',
    'PASSWORD_CHANGE',
    'PASSWORD_CHANGE_FAILED',
    'OTP_SENT',
    'OTP_VERIFIED',
    'OTP_FAILED',
    'REAUTH_STARTED',
    'REAUTH_COMPLETED',
    'REAUTH_FAILED',
    'SESSION_REVOKED'
);

CREATE TYPE "CustomerReauthMethod" AS ENUM (
    'PASSWORD',
    'GOOGLE',
    'OTP'
);

CREATE TYPE "PasswordResetChannel" AS ENUM (
    'EMAIL',
    'PHONE',
    'GOOGLE'
);

-- Extend customer security fields
ALTER TABLE "Customer"
    ADD COLUMN "passwordAlgorithm" TEXT DEFAULT 'bcrypt',
    ADD COLUMN "passwordAlgVersion" INTEGER DEFAULT 12,
    ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3),
    ADD COLUMN "storefrontSessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Extend password reset token metadata
ALTER TABLE "PasswordResetToken"
    ADD COLUMN "channel" "PasswordResetChannel" NOT NULL DEFAULT 'EMAIL',
    ADD COLUMN "targetIdentifierHash" TEXT,
    ADD COLUMN "signingKid" TEXT,
    ADD COLUMN "metadata" JSONB,
    ADD COLUMN "userAgent" TEXT;

ALTER TABLE "StorefrontOAuthSession"
    ADD COLUMN "purpose" TEXT DEFAULT 'login',
    ADD COLUMN "expectedCustomerId" INTEGER;

ALTER TABLE "StorefrontOAuthSession"
    ADD CONSTRAINT "StorefrontOAuthSession_expectedCustomerId_fkey"
        FOREIGN KEY ("expectedCustomerId")
        REFERENCES "Customer" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;

CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");
CREATE INDEX "PasswordResetToken_channel_idx" ON "PasswordResetToken" ("channel");

-- Customer security audit log
CREATE TABLE "CustomerSecurityEvent" (
    "id" SERIAL PRIMARY KEY,
    "customerId" INTEGER,
    "eventType" "CustomerSecurityEventType" NOT NULL,
    "channel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CustomerSecurityEvent_customerId_idx" ON "CustomerSecurityEvent" ("customerId");
CREATE INDEX "CustomerSecurityEvent_createdAt_idx" ON "CustomerSecurityEvent" ("createdAt");

ALTER TABLE "CustomerSecurityEvent"
    ADD CONSTRAINT "CustomerSecurityEvent_customerId_fkey"
        FOREIGN KEY ("customerId")
        REFERENCES "Customer" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;

-- Customer OTP challenges
CREATE TABLE "CustomerOtpChallenge" (
    "id" SERIAL PRIMARY KEY,
    "customerId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "otpLength" INTEGER NOT NULL DEFAULT 6,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "channel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CustomerOtpChallenge_customerId_idx" ON "CustomerOtpChallenge" ("customerId");
CREATE INDEX "CustomerOtpChallenge_phone_idx" ON "CustomerOtpChallenge" ("phone");
CREATE INDEX "CustomerOtpChallenge_expiresAt_idx" ON "CustomerOtpChallenge" ("expiresAt");
CREATE INDEX "CustomerOtpChallenge_createdAt_idx" ON "CustomerOtpChallenge" ("createdAt");

ALTER TABLE "CustomerOtpChallenge"
    ADD CONSTRAINT "CustomerOtpChallenge_customerId_fkey"
        FOREIGN KEY ("customerId")
        REFERENCES "Customer" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;

-- Customer reauthentication tokens
CREATE TABLE "CustomerReauthToken" (
    "id" SERIAL PRIMARY KEY,
    "customerId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "method" "CustomerReauthMethod" NOT NULL,
    "factors" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CustomerReauthToken_tokenHash_key" ON "CustomerReauthToken" ("tokenHash");
CREATE INDEX "CustomerReauthToken_customerId_idx" ON "CustomerReauthToken" ("customerId");
CREATE INDEX "CustomerReauthToken_expiresAt_idx" ON "CustomerReauthToken" ("expiresAt");

ALTER TABLE "CustomerReauthToken"
    ADD CONSTRAINT "CustomerReauthToken_customerId_fkey"
        FOREIGN KEY ("customerId")
        REFERENCES "Customer" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
