-- Ensure unique relation between production orders and work orders
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrder_workOrderId_key" ON "ProductionOrder"("workOrderId");
