WITH ranked AS (
  SELECT
    id,
    "orderId",
    reference,
    MIN(id) OVER (PARTITION BY "orderId", reference) AS keeper_id,
    ROW_NUMBER() OVER (PARTITION BY "orderId", reference ORDER BY id) AS rn
  FROM "Payment"
  WHERE reference IS NOT NULL
),
duplicates AS (
  SELECT id, keeper_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "Notification" AS notification
SET "paymentId" = duplicates.keeper_id
FROM duplicates
WHERE notification."paymentId" = duplicates.id;

WITH ranked AS (
  SELECT
    id,
    "orderId",
    reference,
    MIN(id) OVER (PARTITION BY "orderId", reference) AS keeper_id,
    ROW_NUMBER() OVER (PARTITION BY "orderId", reference ORDER BY id) AS rn
  FROM "Payment"
  WHERE reference IS NOT NULL
),
duplicates AS (
  SELECT id, keeper_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "PaymentAttachment" AS attachment
SET "paymentId" = duplicates.keeper_id
FROM duplicates
WHERE attachment."paymentId" = duplicates.id;

WITH ranked AS (
  SELECT
    id,
    "orderId",
    reference,
    MIN(id) OVER (PARTITION BY "orderId", reference) AS keeper_id,
    ROW_NUMBER() OVER (PARTITION BY "orderId", reference ORDER BY id) AS rn
  FROM "Payment"
  WHERE reference IS NOT NULL
),
duplicates AS (
  SELECT id, keeper_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "OrderTimelineEvent" AS timeline
SET metadata = jsonb_set(
  COALESCE(timeline.metadata, '{}'::jsonb),
  '{paymentId}',
  to_jsonb(duplicates.keeper_id),
  true
)
FROM duplicates
WHERE (timeline.metadata ->> 'paymentId')::int = duplicates.id;

WITH ranked AS (
  SELECT
    id,
    "orderId",
    reference,
    ROW_NUMBER() OVER (PARTITION BY "orderId", reference ORDER BY id) AS rn
  FROM "Payment"
  WHERE reference IS NOT NULL
)
DELETE FROM "Payment" AS payment
USING ranked
WHERE payment.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "payment_order_reference_unique"
ON "Payment" ("orderId", "reference");
