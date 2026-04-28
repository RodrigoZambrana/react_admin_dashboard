CREATE INDEX IF NOT EXISTS "notification_customer_audience_created_at_idx"
ON "Notification" ("customerId", "audience", "createdAt");

CREATE INDEX IF NOT EXISTS "notification_recipient_audience_created_at_idx"
ON "Notification" ("recipientId", "audience", "createdAt");
