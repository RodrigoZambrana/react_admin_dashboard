-- Add support for storing country/code/city for users
ALTER TABLE "User"
    ADD COLUMN "country" TEXT,
    ADD COLUMN "countryCode" TEXT,
    ADD COLUMN "city" TEXT;
