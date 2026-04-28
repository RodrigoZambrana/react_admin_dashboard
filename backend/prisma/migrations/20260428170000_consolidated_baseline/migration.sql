-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER', 'OPS', 'SALES', 'FINANCE');

-- CreateEnum
CREATE TYPE "UserCapability" AS ENUM ('CONVERSATIONS_MANAGE', 'CUSTOMERS_MANAGE', 'APPOINTMENTS_MANAGE', 'CATALOG_MANAGE', 'ORDERS_MANAGE', 'QUOTES_MANAGE', 'PAYMENTS_MANAGE', 'ABERTURAS_QUOTE', 'ABERTURAS_REGISTER', 'KNOWLEDGE_MANAGE', 'AI_SETTINGS_MANAGE', 'USERS_MANAGE');

-- CreateEnum
CREATE TYPE "UserCapabilityGroup" AS ENUM ('SUPPORT', 'SALES', 'OPERATIONS', 'FINANCE', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEETING', 'TASK', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('LOGIN', 'PASSWORD_CHANGE', 'DEVICE_SIGN_IN', 'PROFILE_UPDATE', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "SalesUnit" AS ENUM ('UNIT', 'SQUARE_METER', 'LINEAR_METER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ORDER', 'BUDGET');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'BALANCE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "DepositRequirementType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductMode" AS ENUM ('SIMPLE', 'VARIABLE', 'PARAMETRIC');

-- CreateEnum
CREATE TYPE "InstallationResolutionMode" AS ENUM ('INCLUDED', 'OPTIONAL_ADD_ON', 'SEPARATE_SERVICE', 'NOT_OFFERED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InstallationChargeScope" AS ENUM ('PER_QUOTE', 'MATCH_PRODUCT_QUANTITY', 'MATCH_PRODUCT_MEASUREMENTS');

-- CreateEnum
CREATE TYPE "InstallationPricePresentationMode" AS ENUM ('EXACT', 'FROM_BASE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ProductRelationType" AS ENUM ('RELATED', 'FREQUENTLY_BOUGHT_TOGETHER', 'SUGGESTED_ADD_ON', 'INSTALLATION_ADD_ON');

-- CreateEnum
CREATE TYPE "ProductReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ProductAttributeType" AS ENUM ('COLOR', 'SIZE', 'MATERIAL');

-- CreateEnum
CREATE TYPE "CmsEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CmsPageScope" AS ENUM ('GENERAL_SITE', 'STOREFRONT');

-- CreateEnum
CREATE TYPE "CmsEntryAssetType" AS ENUM ('IMAGE', 'VIDEO', 'EMBED');

-- CreateEnum
CREATE TYPE "CmsPageSectionType" AS ENUM ('SITE_HEADER', 'HERO', 'RICH_TEXT', 'MEDIA_GRID', 'MEDIA_CAROUSEL', 'CONTENT_SPLIT', 'CTA_BANNER', 'FAQ', 'FEATURE_GRID', 'BUDGET_CALCULATOR', 'SITE_FOOTER');

-- CreateEnum
CREATE TYPE "CmsPageBlockType" AS ENUM ('TEXT', 'RICH_TEXT', 'IMAGE', 'BUTTON', 'LIST_ITEM', 'FAQ_ITEM', 'CARD');

-- CreateEnum
CREATE TYPE "CmsMediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'EMBED', 'AUDIO');

-- CreateEnum
CREATE TYPE "InboxChannelType" AS ENUM ('EMAIL', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'SMS', 'OTHER');

-- CreateEnum
CREATE TYPE "InboxMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "InboxMessageEventType" AS ENUM ('CREATED', 'FETCHED', 'FLAG_UPDATED', 'MOVED', 'SENT', 'SYNCED', 'ERROR');

-- CreateEnum
CREATE TYPE "ConversationScope" AS ENUM ('CUSTOMER_PUBLIC', 'CUSTOMER_AUTHENTICATED', 'ADMIN_INTERNAL');

-- CreateEnum
CREATE TYPE "ConversationRole" AS ENUM ('CUSTOMER_PUBLIC', 'CUSTOMER_AUTHENTICATED', 'ADMIN_SUPPORT', 'ADMIN_SALES', 'ADMIN_OPERATIONS', 'ADMIN_SUPERVISOR', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WEBCHAT', 'EMAIL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'ADMIN_CHAT');

-- CreateEnum
CREATE TYPE "ConversationControlMode" AS ENUM ('AI', 'HUMAN', 'HYBRID');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'WAITING_CUSTOMER', 'WAITING_INTERNAL');

-- CreateEnum
CREATE TYPE "ConversationParticipantRole" AS ENUM ('CUSTOMER', 'OPERATOR', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationExternalIdentityKind" AS ENUM ('USER', 'THREAD', 'CANONICAL', 'ALIAS');

-- CreateEnum
CREATE TYPE "ConversationMessageAuthorType" AS ENUM ('CUSTOMER', 'OPERATOR', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationMessageKind" AS ENUM ('TEXT', 'EMAIL', 'IMAGE', 'FILE', 'SYSTEM_EVENT', 'TOOL_RESULT');

-- CreateEnum
CREATE TYPE "ConversationToolCallStatus" AS ENUM ('REQUESTED', 'VALIDATED', 'REJECTED', 'CONFIRMED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationHandoffEventType" AS ENUM ('HUMAN_TAKEOVER', 'HUMAN_RELEASE', 'AI_SUGGEST_ONLY', 'AI_RESUME', 'ASSIGNED', 'UNASSIGNED');

-- CreateEnum
CREATE TYPE "InboxQueueAssignmentMode" AS ENUM ('MANUAL', 'LEAST_LOADED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('DOCS', 'WEB_URL', 'BACKEND_DATASET', 'ADMIN_CURATED', 'CONVERSATION_DERIVED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeChunkIndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentScope" AS ENUM ('CUSTOMER_PUBLIC', 'ADMIN_INTERNAL');

-- CreateEnum
CREATE TYPE "KnowledgeCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KnowledgeRawEventStatus" AS ENUM ('NEW', 'PROCESSED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "KnowledgeIngestionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeSuggestionFeedbackOutcome" AS ENUM ('USED', 'EDITED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotStatus" AS ENUM ('BUILDING', 'READY', 'FAILED', 'STALE');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotEntryType" AS ENUM ('TOPIC_SUMMARY', 'APPROVED_RULE', 'APPROVED_RESPONSE_PATTERN', 'GUARDRAIL_NEGATIVE', 'KNOWN_GAP', 'OPERATIONAL_NOTE');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotSourceKind" AS ENUM ('KNOWLEDGE_DOCUMENT', 'KNOWLEDGE_CANDIDATE', 'KNOWLEDGE_RAW_EVENT', 'KNOWLEDGE_CONVERSATION_BUNDLE', 'KNOWLEDGE_NEGATIVE_EXAMPLE', 'KNOWLEDGE_FEEDBACK');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotSourceRole" AS ENUM ('PRIMARY_SUPPORT', 'SECONDARY_SUPPORT', 'GUARDRAIL', 'COUNTEREXAMPLE', 'PENDING_SIGNAL');

-- CreateEnum
CREATE TYPE "KnowledgeConversationBundleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KnowledgeNegativeExampleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KnowledgeNegativeExampleSourceKind" AS ENUM ('REJECTED_CANDIDATE', 'DISCARDED_FEEDBACK', 'MANUAL');

-- CreateEnum
CREATE TYPE "KnowledgeDerivedArtifactType" AS ENUM ('TOPIC_TAXONOMY', 'QUOTE_PROFILE_HINTS', 'MEASUREMENT_CARRIER_TERMS', 'KEYWORD_LEXICON');

-- CreateEnum
CREATE TYPE "KnowledgeDerivedArtifactStatus" AS ENUM ('ACTIVE', 'DISABLED', 'STALE');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('ORDERS', 'PAYMENTS', 'AUTH');

-- CreateEnum
CREATE TYPE "EmailRecipientType" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "EmailTemplateVariant" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('ORDER_RECEIVED', 'PAYMENT_RECEIVED', 'ORDER_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CustomerSecurityEventType" AS ENUM ('PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_RESET_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_CHANGE_FAILED', 'OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'REAUTH_STARTED', 'REAUTH_COMPLETED', 'REAUTH_FAILED', 'SESSION_REVOKED');

-- CreateEnum
CREATE TYPE "CustomerReauthMethod" AS ENUM ('PASSWORD', 'GOOGLE', 'OTP');

-- CreateEnum
CREATE TYPE "PasswordResetChannel" AS ENUM ('EMAIL', 'PHONE', 'GOOGLE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "eventType" "NotificationEventType",
    "audience" "NotificationAudience",
    "channel" "NotificationChannel",
    "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipientId" INTEGER,
    "customerId" INTEGER,
    "orderId" INTEGER,
    "paymentId" INTEGER,
    "title" TEXT,
    "body" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "readAt" TIMESTAMP(3),
    "readed" BOOLEAN NOT NULL DEFAULT false,
    "target" TEXT,
    "description" TEXT,
    "type" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "location" TEXT,
    "locationLabel" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" SERIAL NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateKey" TEXT,
    "localeOverrides" JSONB,
    "emailSubject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "img" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "capabilityGroups" "UserCapabilityGroup"[] DEFAULT ARRAY[]::"UserCapabilityGroup"[],
    "directCapabilities" "UserCapability"[] DEFAULT ARRAY[]::"UserCapability"[],
    "lang" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT,
    "countryCode" TEXT,
    "city" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "displayName" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "lastIpAddress" TEXT,
    "deviceType" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "UserActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "img" TEXT,
    "location" TEXT,
    "title" TEXT,
    "phoneNumber" TEXT,
    "passwordHash" TEXT,
    "storefrontDefaultPasswordHash" TEXT,
    "passwordAlgorithm" TEXT DEFAULT 'bcrypt',
    "passwordAlgVersion" INTEGER DEFAULT 12,
    "passwordUpdatedAt" TIMESTAMP(3),
    "storefrontSessionVersion" INTEGER NOT NULL DEFAULT 1,
    "birthday" TIMESTAMP(3),
    "facebook" TEXT,
    "twitter" TEXT,
    "pinterest" TEXT,
    "linkedIn" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'es',
    "preferredCurrency" TEXT NOT NULL DEFAULT 'UYU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "statusId" INTEGER,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEmailVerificationToken" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOAuthAccount" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "givenName" TEXT,
    "familyName" TEXT,
    "picture" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "CustomerOAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPhone" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSecurityEvent" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "eventType" "CustomerSecurityEventType" NOT NULL,
    "channel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOtpChallenge" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "otpLength" INTEGER NOT NULL DEFAULT 6,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "channel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReauthToken" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "method" "CustomerReauthMethod" NOT NULL,
    "factors" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReauthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" SERIAL NOT NULL,
    "wishlistId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "productCode" TEXT,
    "img" TEXT,
    "description" TEXT,
    "specifications" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImageUrl" TEXT,
    "categoryId" INTEGER,
    "installationResolutionMode" "InstallationResolutionMode",
    "installationChargeScope" "InstallationChargeScope",
    "installationPricePresentationMode" "InstallationPricePresentationMode",
    "installServiceProductId" INTEGER,
    "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "mode" "ProductMode" NOT NULL DEFAULT 'SIMPLE',
    "calculationStrategy" TEXT NOT NULL DEFAULT 'M2',
    "precio_venta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precio_costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UYU',
    "unitOfMeasure" "SalesUnit" NOT NULL DEFAULT 'UNIT',
    "isBudgetCalculable" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "permanentStock" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER NOT NULL DEFAULT 0,
    "costPerItem" DOUBLE PRECISION,
    "bulkDiscountPrice" DOUBLE PRECISION,
    "taxRate" DOUBLE PRECISION DEFAULT 22,
    "tags" TEXT[],
    "brand" TEXT,
    "vendor" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "ProductImage" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "name" TEXT,
    "img" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" "ProductAttributeType" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOptionValue" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "colorHex" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "label" TEXT,
    "salePrice" DECIMAL(12,2),
    "costPrice" DECIMAL(12,2),
    "stock" INTEGER,
    "permanentStock" BOOLEAN,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inheritSalePrice" BOOLEAN NOT NULL DEFAULT true,
    "inheritCostPrice" BOOLEAN NOT NULL DEFAULT true,
    "inheritStock" BOOLEAN NOT NULL DEFAULT true,
    "inheritSku" BOOLEAN NOT NULL DEFAULT true,
    "inheritImages" BOOLEAN NOT NULL DEFAULT true,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "combinationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantSelection" (
    "variantId" INTEGER NOT NULL,
    "optionValueId" INTEGER NOT NULL,

    CONSTRAINT "ProductVariantSelection_pkey" PRIMARY KEY ("variantId","optionValueId")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "orderItemId" INTEGER,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "status" "ProductReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImageUrl" TEXT,
    "parentId" INTEGER,
    "installationResolutionMode" "InstallationResolutionMode",
    "installationChargeScope" "InstallationChargeScope",
    "installationPricePresentationMode" "InstallationPricePresentationMode",
    "installServiceProductId" INTEGER,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsSection" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntry" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "payload" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "status" "CmsEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "thumbnailUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "productId" INTEGER,
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntryAsset" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "mediaType" "CmsEntryAssetType" NOT NULL DEFAULT 'IMAGE',
    "mediaUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "externalUrl" TEXT,
    "durationSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "scope" "CmsPageScope" NOT NULL DEFAULT 'GENERAL_SITE',
    "locale" TEXT NOT NULL DEFAULT 'es',
    "status" "CmsEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImageUrl" TEXT,
    "layoutKey" TEXT,
    "legacySource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPageAlias" (
    "id" SERIAL NOT NULL,
    "pageId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPageAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPageSection" (
    "id" SERIAL NOT NULL,
    "pageId" INTEGER NOT NULL,
    "type" "CmsPageSectionType" NOT NULL,
    "key" TEXT,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPageBlock" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "type" "CmsPageBlockType" NOT NULL,
    "key" TEXT,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB,
    "mediaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsMedia" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "type" "CmsMediaType" NOT NULL DEFAULT 'IMAGE',
    "alt" TEXT,
    "title" TEXT,
    "mimeType" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "source" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecureConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecureConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'ORDER',
    "customerId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethodId" INTEGER,
    "shippingAddress1" TEXT,
    "shippingAddress2" TEXT,
    "shippingCity" TEXT,
    "shippingDepartment" TEXT,
    "shippingState" TEXT,
    "shippingNeighborhood" TEXT,
    "shippingZip" TEXT,
    "shippingCountry" TEXT,
    "billingAddress1" TEXT,
    "billingAddress2" TEXT,
    "billingCity" TEXT,
    "billingDepartment" TEXT,
    "billingState" TEXT,
    "billingNeighborhood" TEXT,
    "billingZip" TEXT,
    "billingCountry" TEXT,
    "billingSameAsShipping" BOOLEAN NOT NULL DEFAULT false,
    "shippingVendor" TEXT,
    "deliveryFees" DECIMAL(18,2) DEFAULT 0,
    "estimatedMin" INTEGER DEFAULT 1,
    "estimatedMax" INTEGER DEFAULT 3,
    "comment" TEXT,
    "disclaimer" TEXT,
    "metadata" JSONB,
    "statusId" INTEGER,
    "subTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimumDepositType" "DepositRequirementType" NOT NULL DEFAULT 'PERCENTAGE',
    "minimumDepositValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "depositSatisfiedAt" TIMESTAMP(3),
    "customerCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "orderCurrency" TEXT NOT NULL DEFAULT 'UYU',
    "fxBase" TEXT,
    "fxRates" JSONB,
    "currencySnapshot" TEXT,
    "taxRateSnapshot" DECIMAL(18,4),
    "priceListIdSnapshot" INTEGER,
    "exchangeRateSnapshot" JSONB,
    "validUntil" TIMESTAMP(3),
    "activityId" INTEGER,
    "originId" INTEGER,
    "convertedOrderId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "convertedBy" INTEGER,
    "session_id" TEXT,
    "user_id" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer" TEXT,
    "documentFilePath" TEXT,
    "documentFileName" TEXT,
    "documentFileMime" TEXT,
    "documentFileSize" INTEGER,
    "documentGeneratedAt" TIMESTAMP(3),
    "documentPdf" BYTEA,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTimelineEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "amount" DECIMAL(18,2),
    "currency" TEXT,
    "paymentMethod" TEXT,
    "remainingAmount" DECIMAL(18,2),
    "estimateDate" TIMESTAMP(3),
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "correlation_id" TEXT,
    "user_id" TEXT,
    "url" TEXT NOT NULL,
    "referrer" TEXT,
    "user_agent" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_facts" (
    "id" BIGSERIAL NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "event_date" DATE NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "page" TEXT,
    "path" TEXT,
    "product_id" TEXT,
    "category" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer" TEXT,
    "device" TEXT,
    "country" TEXT,
    "value" DECIMAL(18,4),
    "source_event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "first_seen" TIMESTAMP(3),
    "last_seen" TIMESTAMP(3),
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "img" TEXT,
    "description" TEXT,
    "comments" TEXT,
    "unitAmount" DECIMAL(18,4),
    "unitCurrency" TEXT,
    "unitAmountOrderCurrency" DECIMAL(18,4),
    "conversionRate" DECIMAL(18,8),
    "unitCostAmount" DECIMAL(18,4),
    "unitCostCurrency" TEXT,
    "unitCostOrderCurrency" DECIMAL(18,4),
    "customAttributes" JSONB DEFAULT '{}',
    "pricingMethodSnapshot" "SalesUnit",
    "unitPriceSnapshot" DECIMAL(18,4),
    "skuSnapshot" TEXT,
    "nameSnapshot" TEXT,
    "specSummary" TEXT,
    "specJson" JSONB DEFAULT '{}',
    "parametricConfig" JSONB,
    "parametricBreakdown" JSONB,
    "parametricReferenceDate" TIMESTAMP(3),
    "parametricSource" TEXT,
    "parametricVersion" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "paymentMethodId" INTEGER,
    "method" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'BALANCE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'REGISTERED',
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlanMilestone" (
    "id" SERIAL NOT NULL,
    "paymentPlanId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "requirementType" "DepositRequirementType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlanMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttachment" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "assignedToId" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" SERIAL NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontPaymentIntent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "installments" INTEGER,
    "paymentMethodId" TEXT,
    "paymentTypeId" TEXT,
    "cardBrand" TEXT,
    "cardLastFour" TEXT,
    "cardholderName" TEXT,
    "statementDescriptor" TEXT,
    "description" TEXT,
    "cartId" TEXT,
    "orderId" INTEGER,
    "payerEmail" TEXT,
    "payerIdentificationType" TEXT,
    "payerIdentificationNumber" TEXT,
    "payerFirstName" TEXT,
    "payerLastName" TEXT,
    "riskLevel" TEXT,
    "fraudStatus" TEXT,
    "captureMethod" TEXT,
    "paymentMethodType" TEXT,
    "metadata" JSONB,
    "rawResponse" JSONB,
    "rawError" JSONB,
    "idempotencyKey" TEXT,
    "requestId" TEXT,
    "liveMode" BOOLEAN,
    "refundsRaw" JSONB,
    "processedAt" TIMESTAMP(3),
    "statusUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontPaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontOAuthSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "returnPath" TEXT,
    "purpose" TEXT DEFAULT 'login',
    "expectedCustomerId" INTEGER,
    "scopes" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "StorefrontOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingOption" (
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

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" VARCHAR(8),
    "categoryId" INTEGER,
    "statusId" INTEGER,
    "paymentMethodId" INTEGER,
    "paymentReference" TEXT,
    "taxCreditEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "ExpenseStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "CustomerStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT,
    "projectId" INTEGER,
    "createdById" INTEGER,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "ActivityColumn" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTicket" (
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
CREATE TABLE "ActivityTicketMember" (
    "ticketId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ActivityTicketMember_pkey" PRIMARY KEY ("ticketId","userId")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'OTHER',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "color" VARCHAR(32),
    "metadata" JSONB,
    "createdById" INTEGER,
    "projectId" INTEGER,
    "taskId" INTEGER,
    "eventTypeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventAttachment" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventComment" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventComment_pkey" PRIMARY KEY ("id")
);

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
    "seoDescription" TEXT,
    "seoAuthor" TEXT,
    "seoImageUrl" TEXT,
    "googleSiteVerification" TEXT,
    "logo" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "corner" TEXT,
    "apartment" TEXT,
    "department" TEXT,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "country" TEXT NOT NULL,
    "comments" TEXT,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAccount" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "address" TEXT,
    "channel" "InboxChannelType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "InboxChannelType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'generic',
    "messageUid" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "threadRemoteId" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "previewText" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "replyToAddresses" TEXT[],
    "direction" "InboxMessageDirection" NOT NULL,
    "folder" TEXT,
    "queueId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "bodyHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "remoteId" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxSyncState" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "InboxChannelType" NOT NULL,
    "folder" TEXT NOT NULL,
    "lastRemoteId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxQueue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "slaTargetMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxAssignedConversations" INTEGER,
    "assignmentMode" "InboxQueueAssignmentMode" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxQueueUserAssignment" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "maxOpenConversations" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxQueueUserAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessageEvent" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" "InboxMessageEventType" NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxMessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "ConversationScope" NOT NULL,
    "conversationRole" "ConversationRole" NOT NULL DEFAULT 'CUSTOMER_PUBLIC',
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "controlMode" "ConversationControlMode" NOT NULL DEFAULT 'AI',
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT,
    "customerId" INTEGER,
    "assignedToUserId" INTEGER,
    "inboxAccountId" TEXT,
    "externalUserId" TEXT,
    "externalThreadId" TEXT,
    "externalChannelRef" TEXT,
    "metadata" JSONB,
    "pinnedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "ConversationReadState" (
    "conversationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "manualUnread" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationReadState_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationParticipantRole" NOT NULL,
    "userId" INTEGER,
    "customerId" INTEGER,
    "externalUserId" TEXT,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorType" "ConversationMessageAuthorType" NOT NULL,
    "kind" "ConversationMessageKind" NOT NULL DEFAULT 'TEXT',
    "authorUserId" INTEGER,
    "authorCustomerId" INTEGER,
    "externalMessageId" TEXT,
    "inboxMessageId" TEXT,
    "body" TEXT,
    "normalizedText" TEXT,
    "payload" JSONB,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationHandoffEvent" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" "ConversationHandoffEventType" NOT NULL,
    "actorUserId" INTEGER,
    "previousMode" "ConversationControlMode",
    "nextMode" "ConversationControlMode",
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationHandoffEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationToolCall" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" TEXT NOT NULL,
    "status" "ConversationToolCallStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" "ConversationMessageAuthorType" NOT NULL,
    "requestedByUserId" INTEGER,
    "validatedPayload" JSONB,
    "resultPayload" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "chunkIndexStatus" "KnowledgeChunkIndexStatus" NOT NULL DEFAULT 'PENDING',
    "chunkIndexVersion" INTEGER NOT NULL DEFAULT 1,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "chunkIndexAttempts" INTEGER NOT NULL DEFAULT 0,
    "chunkIndexedAt" TIMESTAMP(3),
    "chunkIndexRequestedAt" TIMESTAMP(3),
    "chunkIndexStartedAt" TIMESTAMP(3),
    "chunkIndexError" TEXT,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "sourceFilePath" TEXT,
    "sourceFileMime" TEXT,
    "sourceFileSize" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "piiRiskLevel" TEXT DEFAULT 'low',
    "metadata" JSONB,
    "authoredByUserId" INTEGER,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentEmbedding" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentChunk" (
    "id" TEXT NOT NULL,
    "chunkKey" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "charLength" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDerivedArtifact" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "type" "KnowledgeDerivedArtifactType" NOT NULL,
    "status" "KnowledgeDerivedArtifactStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceDocumentId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDerivedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCandidate" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'CONVERSATION_DERIVED',
    "status" "KnowledgeCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "observationId" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "redactedExcerpt" TEXT,
    "summary" TEXT,
    "detectedIntent" TEXT,
    "problem" TEXT,
    "contextSummary" TEXT,
    "suggestedResponse" TEXT,
    "approvedResponse" TEXT,
    "confidence" DOUBLE PRECISION,
    "dedupeHash" TEXT,
    "clusterKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "piiDetected" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "conversationId" TEXT,
    "messageId" TEXT,
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeRawEvent" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "sourceAuthorType" "ConversationMessageAuthorType" NOT NULL,
    "status" "KnowledgeRawEventStatus" NOT NULL DEFAULT 'NEW',
    "conversationId" TEXT,
    "messageId" TEXT,
    "userMessage" TEXT NOT NULL,
    "normalizedMessage" TEXT NOT NULL,
    "redactedMessage" TEXT,
    "operatorReply" TEXT,
    "aiReply" TEXT,
    "detectedIntent" TEXT,
    "problem" TEXT,
    "contextSummary" TEXT,
    "suggestedResponse" TEXT,
    "confidence" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "dedupeHash" TEXT,
    "clusterKey" TEXT,
    "messageElements" JSONB,
    "messageContextOrigin" JSONB,
    "attachments" JSONB,
    "metadata" JSONB,
    "ingestionRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRawEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeIngestionRun" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" "KnowledgeIngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCandidates" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdByUserId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSuggestionFeedback" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "targetMessageId" TEXT,
    "operatorMessageId" TEXT,
    "actorUserId" INTEGER,
    "outcome" "KnowledgeSuggestionFeedbackOutcome" NOT NULL,
    "suggestedText" TEXT,
    "finalText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSuggestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeConversationBundle" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "status" "KnowledgeConversationBundleStatus" NOT NULL DEFAULT 'PENDING',
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "detectedIntents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "previewQuestion" TEXT,
    "previewResponse" TEXT,
    "metadata" JSONB,
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeConversationBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeNegativeExample" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "status" "KnowledgeNegativeExampleStatus" NOT NULL DEFAULT 'PENDING',
    "sourceKind" "KnowledgeNegativeExampleSourceKind" NOT NULL,
    "conversationId" TEXT,
    "candidateId" TEXT,
    "feedbackId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "detectedIntent" TEXT,
    "channel" "ConversationChannel",
    "disallowedText" TEXT NOT NULL,
    "correctedText" TEXT,
    "metadata" JSONB,
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeNegativeExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshot" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "status" "KnowledgeSnapshotStatus" NOT NULL DEFAULT 'BUILDING',
    "version" INTEGER NOT NULL,
    "generationReason" TEXT NOT NULL,
    "summaryText" TEXT,
    "metrics" JSONB,
    "coverageScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "generatedByUserId" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshotEntry" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "entryType" "KnowledgeSnapshotEntryType" NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "normalizedIntent" TEXT,
    "topicKey" TEXT,
    "confidence" DOUBLE PRECISION,
    "priority" TEXT,
    "appliesToChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSnapshotEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshotSource" (
    "id" TEXT NOT NULL,
    "snapshotEntryId" TEXT NOT NULL,
    "sourceKind" "KnowledgeSnapshotSourceKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" INTEGER,
    "sourceStatus" TEXT,
    "role" "KnowledgeSnapshotSourceRole" NOT NULL,
    "excerpt" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSnapshotSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSetting" (
    "id" SERIAL NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "adminRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" SERIAL NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "variant" "EmailTemplateVariant" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleNotificationRule" (
    "id" SERIAL NOT NULL,
    "role" "Role" NOT NULL,
    "categories" "EmailCategory"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" SERIAL NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "templateId" INTEGER,
    "locale" TEXT NOT NULL,
    "recipientType" "EmailRecipientType" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER,
    "customerId" INTEGER,
    "channel" "PasswordResetChannel" NOT NULL DEFAULT 'EMAIL',
    "targetIdentifierHash" TEXT,
    "signingKid" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_price_matrix" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "option_state" TEXT NOT NULL DEFAULT 'BASE',
    "familyId" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "vidrio" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "hasMosquitero" BOOLEAN NOT NULL DEFAULT false,
    "hasShutterMonoblock" BOOLEAN NOT NULL DEFAULT false,
    "shutterSystem" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(14,4) NOT NULL,
    "priceBase" DECIMAL(14,4),
    "priceMosquitero" DECIMAL(14,4),
    "priceMonoblock" DECIMAL(14,4),
    "priceMonoblockMosquitero" DECIMAL(14,4),
    "hasMosquiteroOption" BOOLEAN NOT NULL DEFAULT false,
    "hasMonoblockOption" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "detailSnapshot" TEXT,
    "price_lineage" JSONB,
    "conflict_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "reference_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_price_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametric_matrix_staging" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "option_state" TEXT NOT NULL DEFAULT 'BASE',
    "familyId" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "vidrio" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "hasMosquitero" BOOLEAN NOT NULL DEFAULT false,
    "hasShutterMonoblock" BOOLEAN NOT NULL DEFAULT false,
    "shutterSystem" TEXT NOT NULL DEFAULT '',
    "hasMosquiteroOption" BOOLEAN NOT NULL DEFAULT false,
    "hasMonoblockOption" BOOLEAN NOT NULL DEFAULT false,
    "priceBase" DECIMAL(14,4),
    "priceMosquitero" DECIMAL(14,4),
    "priceMonoblock" DECIMAL(14,4),
    "priceMonoblockMosquitero" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "specifications" TEXT,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "source" TEXT,
    "reference_date" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "payload" JSONB,

    CONSTRAINT "parametric_matrix_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametric_compatibility_rules" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleValue" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametric_compatibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abertura_glossary_items" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "adjustPct" DECIMAL(8,3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abertura_glossary_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_idempotency_key_unique" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notification_recipient_read_at_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "notification_customer_read_at_idx" ON "Notification"("customerId", "readAt");

-- CreateIndex
CREATE INDEX "notification_event_audience_channel_idx" ON "Notification"("eventType", "audience", "channel");

-- CreateIndex
CREATE INDEX "notification_customer_audience_created_at_idx" ON "Notification"("customerId", "audience", "createdAt");

-- CreateIndex
CREATE INDEX "notification_recipient_audience_created_at_idx" ON "Notification"("recipientId", "audience", "createdAt");

-- CreateIndex
CREATE INDEX "notification_order_id_id_idx" ON "Notification"("orderId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_event_channel_unique" ON "NotificationSetting"("eventType", "audience", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_fingerprint_key" ON "UserDevice"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneNumber_key" ON "Customer"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEmailVerificationToken_tokenHash_key" ON "CustomerEmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerEmailVerificationToken_customerId_idx" ON "CustomerEmailVerificationToken"("customerId");

-- CreateIndex
CREATE INDEX "CustomerEmailVerificationToken_expiresAt_idx" ON "CustomerEmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "CustomerOAuthAccount_customerId_idx" ON "CustomerOAuthAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOAuthAccount_provider_providerAccountId_key" ON "CustomerOAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "CustomerSecurityEvent_customerId_idx" ON "CustomerSecurityEvent"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSecurityEvent_createdAt_idx" ON "CustomerSecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerOtpChallenge_customerId_idx" ON "CustomerOtpChallenge"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOtpChallenge_phone_idx" ON "CustomerOtpChallenge"("phone");

-- CreateIndex
CREATE INDEX "CustomerOtpChallenge_expiresAt_idx" ON "CustomerOtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "CustomerOtpChallenge_createdAt_idx" ON "CustomerOtpChallenge"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReauthToken_tokenHash_key" ON "CustomerReauthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerReauthToken_customerId_idx" ON "CustomerReauthToken"("customerId");

-- CreateIndex
CREATE INDEX "CustomerReauthToken_expiresAt_idx" ON "CustomerReauthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_customerId_key" ON "Wishlist"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_key" ON "WishlistItem"("wishlistId", "productId");

-- CreateIndex
CREATE INDEX "Product_installServiceProductId_idx" ON "Product"("installServiceProductId");

-- CreateIndex
CREATE INDEX "StandardSize_isActive_sortOrder_idx" ON "StandardSize"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StandardSize_width_height_key" ON "StandardSize"("width", "height");

-- CreateIndex
CREATE INDEX "ProductRelation_productId_type_isActive_sortOrder_idx" ON "ProductRelation"("productId", "type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductRelation_relatedProductId_type_isActive_idx" ON "ProductRelation"("relatedProductId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelation_productId_relatedProductId_type_key" ON "ProductRelation"("productId", "relatedProductId", "type");

-- CreateIndex
CREATE INDEX "ProductImage_productId_variantId_idx" ON "ProductImage"("productId", "variantId");

-- CreateIndex
CREATE INDEX "ProductOption_productId_idx" ON "ProductOption"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_type_key" ON "ProductOption"("productId", "type");

-- CreateIndex
CREATE INDEX "ProductOptionValue_optionId_idx" ON "ProductOptionValue"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptionValue_optionId_code_key" ON "ProductOptionValue"("optionId", "code");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_combinationKey_key" ON "ProductVariant"("productId", "combinationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_key_key" ON "ProductVariant"("productId", "key");

-- CreateIndex
CREATE INDEX "ProductVariantSelection_optionValueId_idx" ON "ProductVariantSelection"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_orderItemId_key" ON "ProductReview"("orderItemId");

-- CreateIndex
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_customerId_createdAt_idx" ON "ProductReview"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_orderItemId_idx" ON "ProductReview"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_installServiceProductId_key" ON "ProductCategory"("installServiceProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsSection_key_key" ON "CmsSection"("key");

-- CreateIndex
CREATE INDEX "CmsSection_isActive_sortOrder_idx" ON "CmsSection"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CmsEntry_sectionId_status_isActive_priority_idx" ON "CmsEntry"("sectionId", "status", "isActive", "priority");

-- CreateIndex
CREATE INDEX "CmsEntry_productId_idx" ON "CmsEntry"("productId");

-- CreateIndex
CREATE INDEX "CmsEntry_categoryId_idx" ON "CmsEntry"("categoryId");

-- CreateIndex
CREATE INDEX "CmsEntry_publishedAt_idx" ON "CmsEntry"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmsEntry_sectionId_locale_slug_key" ON "CmsEntry"("sectionId", "locale", "slug");

-- CreateIndex
CREATE INDEX "CmsEntryAsset_entryId_isActive_sortOrder_idx" ON "CmsEntryAsset"("entryId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_path_key" ON "CmsPage"("path");

-- CreateIndex
CREATE INDEX "CmsPage_scope_status_locale_visible_idx" ON "CmsPage"("scope", "status", "locale", "visible");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPageAlias_path_key" ON "CmsPageAlias"("path");

-- CreateIndex
CREATE INDEX "CmsPageAlias_pageId_idx" ON "CmsPageAlias"("pageId");

-- CreateIndex
CREATE INDEX "CmsPageSection_pageId_sortOrder_visible_idx" ON "CmsPageSection"("pageId", "sortOrder", "visible");

-- CreateIndex
CREATE INDEX "CmsPageBlock_sectionId_sortOrder_visible_idx" ON "CmsPageBlock"("sectionId", "sortOrder", "visible");

-- CreateIndex
CREATE INDEX "CmsPageBlock_mediaId_idx" ON "CmsPageBlock"("mediaId");

-- CreateIndex
CREATE INDEX "CmsMedia_type_isActive_createdAt_idx" ON "CmsMedia"("type", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "setting_environment_idx" ON "Setting"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "setting_key_environment_unique" ON "Setting"("key", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "Order_uuid_key" ON "Order"("uuid");

-- CreateIndex
CREATE INDEX "Order_activityId_idx" ON "Order"("activityId");

-- CreateIndex
CREATE INDEX "Order_documentType_statusId_customerId_createdAt_idx" ON "Order"("documentType", "statusId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_documentType_createdAt_idx" ON "Order"("documentType", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerId_documentType_date_idx" ON "Order"("customerId", "documentType", "date");

-- CreateIndex
CREATE INDEX "Order_validUntil_idx" ON "Order"("validUntil");

-- CreateIndex
CREATE INDEX "Order_session_id_idx" ON "Order"("session_id");

-- CreateIndex
CREATE INDEX "Order_utm_source_utm_campaign_idx" ON "Order"("utm_source", "utm_campaign");

-- CreateIndex
CREATE UNIQUE INDEX "Order_originId_key" ON "Order"("originId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_convertedOrderId_key" ON "Order"("convertedOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTimelineEvent_eventId_key" ON "OrderTimelineEvent"("eventId");

-- CreateIndex
CREATE INDEX "OrderTimelineEvent_orderId_timestamp_idx" ON "OrderTimelineEvent"("orderId", "timestamp");

-- CreateIndex
CREATE INDEX "OrderTimelineEvent_orderId_type_idx" ON "OrderTimelineEvent"("orderId", "type");

-- CreateIndex
CREATE INDEX "order_timeline_order_timestamp_id_idx" ON "OrderTimelineEvent"("orderId", "timestamp", "id");

-- CreateIndex
CREATE INDEX "events_event_name_timestamp_idx" ON "events"("event_name", "timestamp");

-- CreateIndex
CREATE INDEX "events_session_id_timestamp_idx" ON "events"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "events_processed_timestamp_idx" ON "events"("processed", "timestamp");

-- CreateIndex
CREATE INDEX "events_correlation_id_idx" ON "events"("correlation_id");

-- CreateIndex
CREATE INDEX "events_createdAt_idx" ON "events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_facts_source_event_id_key" ON "event_facts"("source_event_id");

-- CreateIndex
CREATE INDEX "event_facts_event_name_event_date_idx" ON "event_facts"("event_name", "event_date");

-- CreateIndex
CREATE INDEX "event_facts_session_id_event_date_idx" ON "event_facts"("session_id", "event_date");

-- CreateIndex
CREATE INDEX "event_facts_utm_source_utm_campaign_idx" ON "event_facts"("utm_source", "utm_campaign");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_type_idx" ON "Payment"("status", "type");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_date_idx" ON "Payment"("orderId", "status", "date");

-- CreateIndex
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_reference_key" ON "Payment"("orderId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_orderId_key" ON "PaymentPlan"("orderId");

-- CreateIndex
CREATE INDEX "PaymentPlanMilestone_paymentPlanId_idx" ON "PaymentPlanMilestone"("paymentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_code_key" ON "WorkOrder"("code");

-- CreateIndex
CREATE INDEX "WorkOrder_orderId_idx" ON "WorkOrder"("orderId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "ProductionOrder_orderId_idx" ON "ProductionOrder"("orderId");

-- CreateIndex
CREATE INDEX "ProductionOrder_workOrderId_idx" ON "ProductionOrder"("workOrderId");

-- CreateIndex
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");

-- CreateIndex
CREATE INDEX "ProductionOrder_assignedToId_idx" ON "ProductionOrder"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_workOrderId_key" ON "ProductionOrder"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_base_quote_key" ON "CurrencyRate"("base", "quote");

-- CreateIndex
CREATE INDEX "StorefrontPaymentIntent_externalPaymentId_idx" ON "StorefrontPaymentIntent"("externalPaymentId");

-- CreateIndex
CREATE INDEX "StorefrontPaymentIntent_orderId_idx" ON "StorefrontPaymentIntent"("orderId");

-- CreateIndex
CREATE INDEX "StorefrontPaymentIntent_cartId_idx" ON "StorefrontPaymentIntent"("cartId");

-- CreateIndex
CREATE INDEX "StorefrontPaymentIntent_payerEmail_idx" ON "StorefrontPaymentIntent"("payerEmail");

-- CreateIndex
CREATE INDEX "StorefrontPaymentIntent_status_idx" ON "StorefrontPaymentIntent"("status");

-- CreateIndex
CREATE INDEX "StorefrontPaymentIntent_provider_status_idx" ON "StorefrontPaymentIntent"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontOAuthSession_state_key" ON "StorefrontOAuthSession"("state");

-- CreateIndex
CREATE INDEX "StorefrontOAuthSession_expiresAt_idx" ON "StorefrontOAuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingOption_name_key" ON "ShippingOption"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseStatus_name_key" ON "ExpenseStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerStatus_name_key" ON "CustomerStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityColumn_title_key" ON "ActivityColumn"("title");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_singleton_key" ON "CompanyProfile"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "InboxAccount_channel_address_key" ON "InboxAccount"("channel", "address");

-- CreateIndex
CREATE INDEX "InboxMessage_accountId_folder_idx" ON "InboxMessage"("accountId", "folder");

-- CreateIndex
CREATE INDEX "InboxMessage_accountId_isRead_idx" ON "InboxMessage"("accountId", "isRead");

-- CreateIndex
CREATE INDEX "InboxMessage_accountId_sentAt_idx" ON "InboxMessage"("accountId", "sentAt");

-- CreateIndex
CREATE INDEX "InboxMessage_queueId_receivedAt_idx" ON "InboxMessage"("queueId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_accountId_channel_remoteId_key" ON "InboxMessage"("accountId", "channel", "remoteId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_messageUid_provider_folder_key" ON "InboxMessage"("messageUid", "provider", "folder");

-- CreateIndex
CREATE UNIQUE INDEX "InboxSyncState_accountId_channel_folder_key" ON "InboxSyncState"("accountId", "channel", "folder");

-- CreateIndex
CREATE UNIQUE INDEX "InboxQueue_slug_key" ON "InboxQueue"("slug");

-- CreateIndex
CREATE INDEX "InboxQueueUserAssignment_queueId_isActive_idx" ON "InboxQueueUserAssignment"("queueId", "isActive");

-- CreateIndex
CREATE INDEX "InboxQueueUserAssignment_userId_isActive_idx" ON "InboxQueueUserAssignment"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InboxQueueUserAssignment_queueId_userId_key" ON "InboxQueueUserAssignment"("queueId", "userId");

-- CreateIndex
CREATE INDEX "InboxMessageEvent_messageId_occurredAt_idx" ON "InboxMessageEvent"("messageId", "occurredAt");

-- CreateIndex
CREATE INDEX "Conversation_tenantKey_scope_channel_status_idx" ON "Conversation"("tenantKey", "scope", "channel", "status");

-- CreateIndex
CREATE INDEX "Conversation_conversationRole_lastMessageAt_idx" ON "Conversation"("conversationRole", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_assignedToUserId_status_lastMessageAt_idx" ON "Conversation"("assignedToUserId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_customerId_lastMessageAt_idx" ON "Conversation"("customerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_inboxAccountId_channel_lastMessageAt_idx" ON "Conversation"("inboxAccountId", "channel", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenantKey_channel_externalThreadId_key" ON "Conversation"("tenantKey", "channel", "externalThreadId");

-- CreateIndex
CREATE INDEX "ConversationExternalIdentity_conversationId_kind_idx" ON "ConversationExternalIdentity"("conversationId", "kind");

-- CreateIndex
CREATE INDEX "ConversationExternalIdentity_tenantKey_channel_normalizedVa_idx" ON "ConversationExternalIdentity"("tenantKey", "channel", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationExternalIdentity_tenantKey_channel_kind_normali_key" ON "ConversationExternalIdentity"("tenantKey", "channel", "kind", "normalizedValue");

-- CreateIndex
CREATE INDEX "ConversationReadState_userId_updatedAt_idx" ON "ConversationReadState"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_role_idx" ON "ConversationParticipant"("conversationId", "role");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_customerId_idx" ON "ConversationParticipant"("customerId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_externalMessageId_idx" ON "ConversationMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "ConversationMessage_inboxMessageId_idx" ON "ConversationMessage"("inboxMessageId");

-- CreateIndex
CREATE INDEX "ConversationHandoffEvent_conversationId_createdAt_idx" ON "ConversationHandoffEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationToolCall_conversationId_status_createdAt_idx" ON "ConversationToolCall"("conversationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationToolCall_messageId_idx" ON "ConversationToolCall"("messageId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_tenantKey_scope_status_sourceType_idx" ON "KnowledgeDocument"("tenantKey", "scope", "status", "sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_tenantKey_chunkIndexStatus_updatedAt_idx" ON "KnowledgeDocument"("tenantKey", "chunkIndexStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_tenantKey_scope_sourceType_sourceKey_key" ON "KnowledgeDocument"("tenantKey", "scope", "sourceType", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentEmbedding_documentId_key" ON "KnowledgeDocumentEmbedding"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentEmbedding_provider_model_idx" ON "KnowledgeDocumentEmbedding"("provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentChunk_chunkKey_key" ON "KnowledgeDocumentChunk"("chunkKey");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentChunk_tenantKey_scope_sourceType_idx" ON "KnowledgeDocumentChunk"("tenantKey", "scope", "sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentChunk_documentId_idx" ON "KnowledgeDocumentChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentChunk_provider_model_idx" ON "KnowledgeDocumentChunk"("provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentChunk_documentId_chunkIndex_key" ON "KnowledgeDocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "KnowledgeDerivedArtifact_tenantKey_scope_type_status_idx" ON "KnowledgeDerivedArtifact"("tenantKey", "scope", "type", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDerivedArtifact_sourceDocumentId_idx" ON "KnowledgeDerivedArtifact"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCandidate_observationId_key" ON "KnowledgeCandidate"("observationId");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_tenantKey_scope_status_sourceType_create_idx" ON "KnowledgeCandidate"("tenantKey", "scope", "status", "sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_conversationId_createdAt_idx" ON "KnowledgeCandidate"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_messageId_idx" ON "KnowledgeCandidate"("messageId");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_tenantKey_dedupeHash_status_idx" ON "KnowledgeCandidate"("tenantKey", "dedupeHash", "status");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_tenantKey_detectedIntent_status_idx" ON "KnowledgeCandidate"("tenantKey", "detectedIntent", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRawEvent_messageId_key" ON "KnowledgeRawEvent"("messageId");

-- CreateIndex
CREATE INDEX "KnowledgeRawEvent_tenantKey_scope_status_createdAt_idx" ON "KnowledgeRawEvent"("tenantKey", "scope", "status", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeRawEvent_conversationId_createdAt_idx" ON "KnowledgeRawEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeRawEvent_ingestionRunId_idx" ON "KnowledgeRawEvent"("ingestionRunId");

-- CreateIndex
CREATE INDEX "KnowledgeRawEvent_tenantKey_dedupeHash_idx" ON "KnowledgeRawEvent"("tenantKey", "dedupeHash");

-- CreateIndex
CREATE INDEX "KnowledgeIngestionRun_tenantKey_status_startedAt_idx" ON "KnowledgeIngestionRun"("tenantKey", "status", "startedAt");

-- CreateIndex
CREATE INDEX "KnowledgeIngestionRun_createdByUserId_startedAt_idx" ON "KnowledgeIngestionRun"("createdByUserId", "startedAt");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_tenantKey_candidateId_outcome_c_idx" ON "KnowledgeSuggestionFeedback"("tenantKey", "candidateId", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_conversationId_createdAt_idx" ON "KnowledgeSuggestionFeedback"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_targetMessageId_idx" ON "KnowledgeSuggestionFeedback"("targetMessageId");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_operatorMessageId_idx" ON "KnowledgeSuggestionFeedback"("operatorMessageId");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_actorUserId_createdAt_idx" ON "KnowledgeSuggestionFeedback"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeConversationBundle_conversationId_key" ON "KnowledgeConversationBundle"("conversationId");

-- CreateIndex
CREATE INDEX "KnowledgeConversationBundle_tenantKey_scope_status_updatedA_idx" ON "KnowledgeConversationBundle"("tenantKey", "scope", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeConversationBundle_tenantKey_conversationId_idx" ON "KnowledgeConversationBundle"("tenantKey", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeNegativeExample_feedbackId_key" ON "KnowledgeNegativeExample"("feedbackId");

-- CreateIndex
CREATE INDEX "KnowledgeNegativeExample_tenantKey_scope_status_sourceKind__idx" ON "KnowledgeNegativeExample"("tenantKey", "scope", "status", "sourceKind", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeNegativeExample_tenantKey_conversationId_updatedAt_idx" ON "KnowledgeNegativeExample"("tenantKey", "conversationId", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshot_tenantKey_scope_status_generatedAt_idx" ON "KnowledgeSnapshot"("tenantKey", "scope", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSnapshot_tenantKey_scope_version_key" ON "KnowledgeSnapshot"("tenantKey", "scope", "version");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotEntry_snapshotId_entryType_idx" ON "KnowledgeSnapshotEntry"("snapshotId", "entryType");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotEntry_tenantKey_scope_entryType_idx" ON "KnowledgeSnapshotEntry"("tenantKey", "scope", "entryType");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotEntry_snapshotId_key_idx" ON "KnowledgeSnapshotEntry"("snapshotId", "key");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotSource_snapshotEntryId_idx" ON "KnowledgeSnapshotSource"("snapshotEntryId");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotSource_sourceKind_sourceId_idx" ON "KnowledgeSnapshotSource"("sourceKind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSetting_category_key" ON "EmailSetting"("category");

-- CreateIndex
CREATE INDEX "EmailTemplate_category_locale_active_idx" ON "EmailTemplate"("category", "locale", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_category_locale_variant_version_key" ON "EmailTemplate"("category", "locale", "variant", "version");

-- CreateIndex
CREATE INDEX "EmailLog_category_status_createdAt_idx" ON "EmailLog"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_toAddress_createdAt_idx" ON "EmailLog"("toAddress", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_templateId_idx" ON "EmailLog"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_customerId_idx" ON "PasswordResetToken"("customerId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_channel_idx" ON "PasswordResetToken"("channel");

-- CreateIndex
CREATE INDEX "dimension_price_matrix_productId_idx" ON "dimension_price_matrix"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_price_matrix_productId_fingerprint_option_state_key" ON "dimension_price_matrix"("productId", "fingerprint", "option_state");

-- CreateIndex
CREATE INDEX "parametric_matrix_staging_productId_processedAt_idx" ON "parametric_matrix_staging"("productId", "processedAt");

-- CreateIndex
CREATE INDEX "parametric_compatibility_rules_productId_type_idx" ON "parametric_compatibility_rules"("productId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "parametric_compatibility_rules_productId_type_ruleKey_key" ON "parametric_compatibility_rules"("productId", "type", "ruleKey");

-- CreateIndex
CREATE INDEX "abertura_glossary_items_category_idx" ON "abertura_glossary_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "abertura_glossary_category_label" ON "abertura_glossary_items"("category", "label");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "UserDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "CustomerStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEmailVerificationToken" ADD CONSTRAINT "CustomerEmailVerificationToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOAuthAccount" ADD CONSTRAINT "CustomerOAuthAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSecurityEvent" ADD CONSTRAINT "CustomerSecurityEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOtpChallenge" ADD CONSTRAINT "CustomerOtpChallenge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReauthToken" ADD CONSTRAINT "CustomerReauthToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_installServiceProductId_fkey" FOREIGN KEY ("installServiceProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantSelection" ADD CONSTRAINT "ProductVariantSelection_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantSelection" ADD CONSTRAINT "ProductVariantSelection_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_installServiceProductId_fkey" FOREIGN KEY ("installServiceProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntry" ADD CONSTRAINT "CmsEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CmsSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntry" ADD CONSTRAINT "CmsEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntry" ADD CONSTRAINT "CmsEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntryAsset" ADD CONSTRAINT "CmsEntryAsset_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CmsEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageAlias" ADD CONSTRAINT "CmsPageAlias_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageSection" ADD CONSTRAINT "CmsPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageBlock" ADD CONSTRAINT "CmsPageBlock_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CmsPageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageBlock" ADD CONSTRAINT "CmsPageBlock_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "CmsMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_convertedBy_fkey" FOREIGN KEY ("convertedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimelineEvent" ADD CONSTRAINT "OrderTimelineEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanMilestone" ADD CONSTRAINT "PaymentPlanMilestone_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttachment" ADD CONSTRAINT "PaymentAttachment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorefrontPaymentIntent" ADD CONSTRAINT "StorefrontPaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ExpenseStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTicket" ADD CONSTRAINT "ActivityTicket_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "ActivityColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTicketMember" ADD CONSTRAINT "ActivityTicketMember_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ActivityTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTicketMember" ADD CONSTRAINT "ActivityTicketMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "CalendarEventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAttachment" ADD CONSTRAINT "CalendarEventAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventComment" ADD CONSTRAINT "CalendarEventComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventComment" ADD CONSTRAINT "CalendarEventComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InboxAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAttachment" ADD CONSTRAINT "InboxAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxSyncState" ADD CONSTRAINT "InboxSyncState_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InboxAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueUserAssignment" ADD CONSTRAINT "InboxQueueUserAssignment_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueUserAssignment" ADD CONSTRAINT "InboxQueueUserAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessageEvent" ADD CONSTRAINT "InboxMessageEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_inboxAccountId_fkey" FOREIGN KEY ("inboxAccountId") REFERENCES "InboxAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationExternalIdentity" ADD CONSTRAINT "ConversationExternalIdentity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReadState" ADD CONSTRAINT "ConversationReadState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReadState" ADD CONSTRAINT "ConversationReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorCustomerId_fkey" FOREIGN KEY ("authorCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_inboxMessageId_fkey" FOREIGN KEY ("inboxMessageId") REFERENCES "InboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHandoffEvent" ADD CONSTRAINT "ConversationHandoffEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHandoffEvent" ADD CONSTRAINT "ConversationHandoffEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationToolCall" ADD CONSTRAINT "ConversationToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationToolCall" ADD CONSTRAINT "ConversationToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationToolCall" ADD CONSTRAINT "ConversationToolCall_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentEmbedding" ADD CONSTRAINT "KnowledgeDocumentEmbedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentChunk" ADD CONSTRAINT "KnowledgeDocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDerivedArtifact" ADD CONSTRAINT "KnowledgeDerivedArtifact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "KnowledgeRawEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRawEvent" ADD CONSTRAINT "KnowledgeRawEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRawEvent" ADD CONSTRAINT "KnowledgeRawEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRawEvent" ADD CONSTRAINT "KnowledgeRawEvent_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "KnowledgeIngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeIngestionRun" ADD CONSTRAINT "KnowledgeIngestionRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KnowledgeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_operatorMessageId_fkey" FOREIGN KEY ("operatorMessageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConversationBundle" ADD CONSTRAINT "KnowledgeConversationBundle_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConversationBundle" ADD CONSTRAINT "KnowledgeConversationBundle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConversationBundle" ADD CONSTRAINT "KnowledgeConversationBundle_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KnowledgeCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "KnowledgeSuggestionFeedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshot" ADD CONSTRAINT "KnowledgeSnapshot_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshotEntry" ADD CONSTRAINT "KnowledgeSnapshotEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "KnowledgeSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshotSource" ADD CONSTRAINT "KnowledgeSnapshotSource_snapshotEntryId_fkey" FOREIGN KEY ("snapshotEntryId") REFERENCES "KnowledgeSnapshotEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_price_matrix" ADD CONSTRAINT "dimension_price_matrix_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametric_matrix_staging" ADD CONSTRAINT "parametric_matrix_staging_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametric_compatibility_rules" ADD CONSTRAINT "parametric_compatibility_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

