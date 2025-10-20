-- CreateEnum
CREATE TYPE "SalesUnit" AS ENUM ('UNIT', 'SQUARE_METER', 'LINEAR_METER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "unitOfMeasure" "SalesUnit" NOT NULL DEFAULT 'UNIT';
