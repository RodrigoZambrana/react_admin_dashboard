-- Drop foreign key constraints that reference the legacy catalog tables
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_paymentMethodId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_paymentMethodId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_statusId_fkey";
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_paymentMethodId_fkey";

-- Drop related indexes that depended on the removed foreign keys
DROP INDEX IF EXISTS "Payment_paymentMethodId_idx";

-- Drop the legacy catalog tables (data now lives in static configuration)
DROP TABLE IF EXISTS "PaymentMethod" CASCADE;
DROP TABLE IF EXISTS "OrderStatus" CASCADE;
