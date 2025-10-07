/*
  Warnings:

  - You are about to drop the `ProductStatus` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Expense" ADD COLUMN     "currency" VARCHAR(8);

-- DropTable
DROP TABLE "public"."ProductStatus";

-- CreateTable
CREATE TABLE "public"."ActivityColumn" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityTicket" (
    "id" SERIAL NOT NULL,
    "columnId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT DEFAULT 'Medium priority',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "cover" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityTicketMember" (
    "ticketId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ActivityTicketMember_pkey" PRIMARY KEY ("ticketId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityColumn_title_key" ON "public"."ActivityColumn"("title");

-- AddForeignKey
ALTER TABLE "public"."ActivityTicket" ADD CONSTRAINT "ActivityTicket_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "public"."ActivityColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityTicketMember" ADD CONSTRAINT "ActivityTicketMember_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."ActivityTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityTicketMember" ADD CONSTRAINT "ActivityTicketMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
