-- Add table for customer phone numbers
CREATE TABLE "CustomerPhone" (
    "id" SERIAL PRIMARY KEY,
    "customerId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPhone_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "CustomerPhone" ("customerId", "phone", "isPrimary")
SELECT "id", "phoneNumber", true
FROM "Customer"
WHERE "phoneNumber" IS NOT NULL AND LENGTH(TRIM("phoneNumber")) > 0;
