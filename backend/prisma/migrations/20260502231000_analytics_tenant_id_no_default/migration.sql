-- Remove compatibility defaults that hide missing tenant routing.

ALTER TABLE "events"
  ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "event_facts"
  ALTER COLUMN "tenant_id" DROP DEFAULT;
