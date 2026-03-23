-- Create table for linked OAuth accounts
CREATE TABLE "CustomerOAuthAccount" (
    "id" SERIAL PRIMARY KEY,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    CONSTRAINT "CustomerOAuthAccount_customerId_fkey"
        FOREIGN KEY ("customerId")
        REFERENCES "Customer"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerOAuthAccount_provider_providerAccountId_key"
    ON "CustomerOAuthAccount"("provider", "providerAccountId");

CREATE INDEX "CustomerOAuthAccount_customerId_idx"
    ON "CustomerOAuthAccount"("customerId");

-- Store short-lived OAuth sessions for PKCE/state validation
CREATE TABLE "StorefrontOAuthSession" (
    "id" TEXT PRIMARY KEY,
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
    "errorMessage" TEXT
);

CREATE UNIQUE INDEX "StorefrontOAuthSession_state_key"
    ON "StorefrontOAuthSession"("state");

CREATE INDEX "StorefrontOAuthSession_expiresAt_idx"
    ON "StorefrontOAuthSession"("expiresAt");
