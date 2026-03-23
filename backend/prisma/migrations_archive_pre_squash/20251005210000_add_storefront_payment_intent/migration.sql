CREATE TABLE "StorefrontPaymentIntent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "amount" NUMERIC(18,2) NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorefrontPaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontPaymentIntent_externalPaymentId_idx"
    ON "StorefrontPaymentIntent"("externalPaymentId");

CREATE INDEX "StorefrontPaymentIntent_orderId_idx"
    ON "StorefrontPaymentIntent"("orderId");

CREATE INDEX "StorefrontPaymentIntent_status_idx"
    ON "StorefrontPaymentIntent"("status");

CREATE INDEX "StorefrontPaymentIntent_provider_status_idx"
    ON "StorefrontPaymentIntent"("provider", "status");

ALTER TABLE "StorefrontPaymentIntent"
    ADD CONSTRAINT "StorefrontPaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
