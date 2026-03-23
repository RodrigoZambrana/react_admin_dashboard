CREATE TYPE "ProductStoryAssetType" AS ENUM ('IMAGE', 'VIDEO', 'EMBED');

ALTER TABLE "Product"
ADD COLUMN "storyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "storyPriority" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ProductStoryAsset" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "mediaType" "ProductStoryAssetType" NOT NULL DEFAULT 'IMAGE',
    "mediaUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "externalUrl" TEXT,
    "durationSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStoryAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Product_storyEnabled_storyPriority_idx" ON "Product"("storyEnabled", "storyPriority");
CREATE INDEX "ProductStoryAsset_productId_isActive_sortOrder_idx" ON "ProductStoryAsset"("productId", "isActive", "sortOrder");

ALTER TABLE "ProductStoryAsset"
ADD CONSTRAINT "ProductStoryAsset_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
