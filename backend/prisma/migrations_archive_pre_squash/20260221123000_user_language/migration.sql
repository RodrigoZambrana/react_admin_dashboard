-- Add persisted language preference for users
ALTER TABLE "User"
    ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'en';
