CREATE INDEX IF NOT EXISTS "Order_customerId_documentType_date_idx"
ON "Order" ("customerId", "documentType", "date");

CREATE INDEX IF NOT EXISTS "Payment_orderId_status_date_idx"
ON "Payment" ("orderId", "status", "date");

CREATE INDEX IF NOT EXISTS "StorefrontPaymentIntent_cartId_idx"
ON "StorefrontPaymentIntent" ("cartId");

CREATE INDEX IF NOT EXISTS "StorefrontPaymentIntent_payerEmail_idx"
ON "StorefrontPaymentIntent" ("payerEmail");

CREATE INDEX IF NOT EXISTS "EmailLog_toAddress_createdAt_idx"
ON "EmailLog" ("toAddress", "createdAt");
