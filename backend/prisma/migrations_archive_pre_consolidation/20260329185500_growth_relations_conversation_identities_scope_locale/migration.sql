-- CreateEnum
CREATE TYPE "ProductRelationType" AS ENUM ('RELATED', 'FREQUENTLY_BOUGHT_TOGETHER', 'SUGGESTED_ADD_ON', 'INSTALLATION_ADD_ON');

-- CreateEnum
CREATE TYPE "CmsPageScope" AS ENUM ('GENERAL_SITE', 'STOREFRONT');

-- CreateEnum
CREATE TYPE "ConversationExternalIdentityKind" AS ENUM ('USER', 'THREAD', 'CANONICAL', 'ALIAS');

-- DropIndex
DROP INDEX "CmsPage_status_locale_visible_idx";

-- AlterTable
ALTER TABLE "CmsPage" ADD COLUMN "scope" "CmsPageScope" NOT NULL DEFAULT 'GENERAL_SITE';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "preferredCurrency" TEXT NOT NULL DEFAULT 'UYU';

-- CreateTable
CREATE TABLE "ProductRelation" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "relatedProductId" INTEGER NOT NULL,
    "type" "ProductRelationType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationExternalIdentity" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "kind" "ConversationExternalIdentityKind" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRelation_productId_type_isActive_sortOrder_idx" ON "ProductRelation"("productId", "type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductRelation_relatedProductId_type_isActive_idx" ON "ProductRelation"("relatedProductId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelation_productId_relatedProductId_type_key" ON "ProductRelation"("productId", "relatedProductId", "type");

-- CreateIndex
CREATE INDEX "ConversationExternalIdentity_conversationId_kind_idx" ON "ConversationExternalIdentity"("conversationId", "kind");

-- CreateIndex
CREATE INDEX "ConversationExternalIdentity_tenantKey_channel_normalizedVa_idx" ON "ConversationExternalIdentity"("tenantKey", "channel", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationExternalIdentity_tenantKey_channel_kind_normali_key" ON "ConversationExternalIdentity"("tenantKey", "channel", "kind", "normalizedValue");

-- CreateIndex
CREATE INDEX "CmsPage_scope_status_locale_visible_idx" ON "CmsPage"("scope", "status", "locale", "visible");

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationExternalIdentity" ADD CONSTRAINT "ConversationExternalIdentity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
