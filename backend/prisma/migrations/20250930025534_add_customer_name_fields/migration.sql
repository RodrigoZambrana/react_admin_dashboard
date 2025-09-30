-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "statusId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."CustomerStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
