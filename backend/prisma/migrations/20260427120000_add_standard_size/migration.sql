-- CreateTable
CREATE TABLE "StandardSize" (
    "id" SERIAL NOT NULL,
    "width" DECIMAL(10,4) NOT NULL,
    "height" DECIMAL(10,4) NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandardSize_isActive_sortOrder_idx" ON "StandardSize"("isActive", "sortOrder");
