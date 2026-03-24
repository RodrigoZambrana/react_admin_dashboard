CREATE INDEX "notification_order_id_id_idx"
ON "Notification" ("orderId", "id");

CREATE INDEX "order_timeline_order_timestamp_id_idx"
ON "OrderTimelineEvent" ("orderId", "timestamp", "id");
