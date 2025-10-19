/*
  Warnings:

  - You are about to alter the column `amount` on the `Expense` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `deliveryFees` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `subTotal` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `tax` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `grandTotal` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.

*/
-- AlterTable
ALTER TABLE "public"."Expense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "fxBase" TEXT,
ADD COLUMN     "fxRates" JSONB,
ADD COLUMN     "orderCurrency" TEXT NOT NULL DEFAULT 'UYU',
ALTER COLUMN "deliveryFees" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "subTotal" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "grandTotal" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "conversionRate" DECIMAL(18,8),
ADD COLUMN     "unitAmount" DECIMAL(18,4),
ADD COLUMN     "unitAmountOrderCurrency" DECIMAL(18,4),
ADD COLUMN     "unitCostAmount" DECIMAL(18,4),
ADD COLUMN     "unitCostCurrency" TEXT,
ADD COLUMN     "unitCostOrderCurrency" DECIMAL(18,4),
ADD COLUMN     "unitCurrency" TEXT,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,2);

-- CreateTable
CREATE TABLE "public"."CurrencyRate" (
    "id" SERIAL NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_base_quote_key" ON "public"."CurrencyRate"("base", "quote");
