-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER', 'OPS', 'SALES', 'FINANCE');

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
CREATE TYPE "ProductAttributeType" AS ENUM ('COLOR', 'SIZE', 'MATERIAL');

-- CreateEnum
CREATE TYPE "InboxChannelType" AS ENUM ('EMAIL', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'SMS', 'OTHER');

-- CreateEnum
CREATE TYPE "InboxMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "InboxMessageEventType" AS ENUM ('CREATED', 'FETCHED', 'FLAG_UPDATED', 'MOVED', 'SENT', 'SYNCED', 'ERROR');

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "statusId" INTEGER,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
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
    "categoryId" INTEGER,
    "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "mode" "ProductMode" NOT NULL DEFAULT 'SIMPLE',
    "precio_venta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precio_costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UYU',
    "unitOfMeasure" "SalesUnit" NOT NULL DEFAULT 'UNIT',
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
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "parentId" INTEGER,
    "installServiceProductId" INTEGER,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
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
    "shippingState" TEXT,
    "shippingZip" TEXT,
    "billingAddress1" TEXT,
    "billingAddress2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "billingSameAsShipping" BOOLEAN NOT NULL DEFAULT false,
    "shippingVendor" TEXT,
    "deliveryFees" DECIMAL(18,2) DEFAULT 0,
    "estimatedMin" INTEGER DEFAULT 1,
    "estimatedMax" INTEGER DEFAULT 3,
    "comment" TEXT,
    "disclaimer" TEXT,
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
    "city" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxQueue_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_installServiceProductId_key" ON "ProductCategory"("installServiceProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_uuid_key" ON "Order"("uuid");

-- CreateIndex
CREATE INDEX "Order_activityId_idx" ON "Order"("activityId");

-- CreateIndex
CREATE INDEX "Order_documentType_statusId_customerId_createdAt_idx" ON "Order"("documentType", "statusId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_documentType_createdAt_idx" ON "Order"("documentType", "createdAt");

-- CreateIndex
CREATE INDEX "Order_validUntil_idx" ON "Order"("validUntil");

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
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_type_idx" ON "Payment"("status", "type");

-- CreateIndex
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

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
CREATE INDEX "InboxMessageEvent_messageId_occurredAt_idx" ON "InboxMessageEvent"("messageId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSetting_category_key" ON "EmailSetting"("category");

-- CreateIndex
CREATE INDEX "EmailTemplate_category_locale_active_idx" ON "EmailTemplate"("category", "locale", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_category_locale_variant_version_key" ON "EmailTemplate"("category", "locale", "variant", "version");

-- CreateIndex
CREATE INDEX "EmailLog_category_status_createdAt_idx" ON "EmailLog"("category", "status", "createdAt");

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
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_installServiceProductId_fkey" FOREIGN KEY ("installServiceProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "InboxMessageEvent" ADD CONSTRAINT "InboxMessageEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

