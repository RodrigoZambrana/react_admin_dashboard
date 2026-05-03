#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker-compose.test.yml"
ENV_FILE="$REPO_ROOT/.env.test"
DEFAULT_DUMP="$HOME/Documents/UrucortinasBackups/latest.sql.gz"
FALLBACK_DUMP="$REPO_ROOT/backups/db/react_admin_dashboard_20260327_170039_postgres-local-pre-recovery.sql.gz"
RESTORE_DUMP="${RESTORE_DUMP:-$DEFAULT_DUMP}"

if [ ! -f "$RESTORE_DUMP" ] && [ -f "$FALLBACK_DUMP" ]; then
  RESTORE_DUMP="$FALLBACK_DUMP"
fi

log() {
  printf '[local-test-restore] %s\n' "$1"
}

wait_for_db() {
  ATTEMPTS=0
  while [ "$ATTEMPTS" -lt 90 ]; do
    if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db pg_isready -U postgres -d react_admin_dashboard_test >/dev/null 2>&1; then
      return 0
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    sleep 2
  done
  log "PostgreSQL did not become ready in time."
  exit 1
}

if [ ! -f "$RESTORE_DUMP" ]; then
  log "Dump not found: $RESTORE_DUMP"
  exit 1
fi

log "Bringing environment down cleanly."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null

log "Starting database and redis."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d db redis >/dev/null
wait_for_db

log "Resetting target schema."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  psql -U postgres -d react_admin_dashboard_test -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null

log "Restoring dump: $(basename "$RESTORE_DUMP")"
gunzip -dc "$RESTORE_DUMP" | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  psql -U postgres -d react_admin_dashboard_test >/dev/null

log "Rehydrating missing analytics baseline tables."
cat <<'SQL' | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  psql -U postgres -d react_admin_dashboard_test >/dev/null
CREATE TABLE IF NOT EXISTS "events" (
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

CREATE TABLE IF NOT EXISTS "event_facts" (
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

CREATE TABLE IF NOT EXISTS "sessions" (
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

CREATE INDEX IF NOT EXISTS "events_event_name_timestamp_idx" ON "events"("event_name", "timestamp");
CREATE INDEX IF NOT EXISTS "events_session_id_timestamp_idx" ON "events"("session_id", "timestamp");
CREATE INDEX IF NOT EXISTS "events_processed_timestamp_idx" ON "events"("processed", "timestamp");
CREATE INDEX IF NOT EXISTS "events_correlation_id_idx" ON "events"("correlation_id");
CREATE INDEX IF NOT EXISTS "events_createdAt_idx" ON "events"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "event_facts_source_event_id_key" ON "event_facts"("source_event_id");
CREATE INDEX IF NOT EXISTS "event_facts_event_name_event_date_idx" ON "event_facts"("event_name", "event_date");
CREATE INDEX IF NOT EXISTS "event_facts_session_id_event_date_idx" ON "event_facts"("session_id", "event_date");
CREATE INDEX IF NOT EXISTS "event_facts_utm_source_utm_campaign_idx" ON "event_facts"("utm_source", "utm_campaign");
SQL

FAILED_CONSOLIDATED=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  psql -U postgres -d react_admin_dashboard_test -Atc \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20260428170000_consolidated_baseline' AND finished_at IS NULL AND rolled_back_at IS NULL;")

if [ "${FAILED_CONSOLIDATED:-0}" != "0" ]; then
  log "Resolving backup migration state."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --entrypoint sh backend -lc \
    'npx prisma migrate resolve --schema prisma/schema.prisma --applied 20260428170000_consolidated_baseline' >/dev/null
fi

log "Starting application services."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend storefront nginx >/dev/null

log "Waiting for application readiness."
LOCAL_TEST_BASE_URL="${LOCAL_TEST_BASE_URL:-http://127.0.0.1:8080}" \
  node "$REPO_ROOT/scripts/local-test-smoke.mjs"

log "Restore completed."
