-- CreateTable
CREATE TABLE "public"."ShippingOption" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryFees" DOUBLE PRECISION DEFAULT 0,
    "estimatedMin" INTEGER DEFAULT 0,
    "estimatedMax" INTEGER DEFAULT 0,
    "img" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingOption_name_key" ON "public"."ShippingOption"("name");
