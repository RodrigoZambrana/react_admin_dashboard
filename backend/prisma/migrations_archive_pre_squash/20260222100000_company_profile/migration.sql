-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" SERIAL NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'default',
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyProfile_singleton_key" UNIQUE ("singleton")
);

-- Seed default company profile
INSERT INTO "CompanyProfile" (
    "singleton",
    "legalName",
    "tradeName",
    "taxId",
    "email",
    "phone",
    "website",
    "addressLine1",
    "addressLine2"
) VALUES (
    'default',
    'Sistema Administrativo, Inc.',
    'Sistema Administrativo',
    'RUC 1234567890',
    'facturacion@sistemadministrativo.com',
    '(123) 456-7890',
    'www.sistemadministrativo.com',
    '9498 Harvard Street',
    'Fairfield, Chicago Town 06824'
) ON CONFLICT ("singleton") DO NOTHING;
