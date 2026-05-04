#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker-compose.test.yml"
ENV_FILE="$REPO_ROOT/.env.test"
DEFAULT_DUMP="$HOME/Documents/UrucortinasBackups/latest.dump"
RESTORE_DUMP="${RESTORE_DUMP:-$DEFAULT_DUMP}"

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
  log "Expected a custom-format PostgreSQL dump (.dump). Run 'make backup' first."
  exit 1
fi

log "Bringing environment down cleanly."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null

log "Starting database and redis."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d db redis >/dev/null
wait_for_db

log "Applying consolidated Prisma schema without seed."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --build --rm --no-deps --entrypoint sh backend -lc \
  'npm run bootstrap:schema:local -- --confirm' >/dev/null

log "Restoring data-only dump into consolidated schema."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc 'cat > /tmp/urucortinas.restore.dump' < "$RESTORE_DUMP"
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc 'pg_restore -l /tmp/urucortinas.restore.dump >/dev/null'; then
  log "Restore dump is not a valid custom-format PostgreSQL archive: $RESTORE_DUMP"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc 'rm -f /tmp/urucortinas.restore.dump' >/dev/null 2>&1 || true
  exit 1
fi
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc \
  'pg_restore -l /tmp/urucortinas.restore.dump > /tmp/urucortinas.restore.list'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc \
  'grep -v "_prisma_migrations" /tmp/urucortinas.restore.list > /tmp/urucortinas.restore.filtered.list'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc \
  'pg_restore -U postgres --dbname react_admin_dashboard_test --data-only --disable-triggers --no-owner --no-privileges -L /tmp/urucortinas.restore.filtered.list /tmp/urucortinas.restore.dump >/dev/null && rm -f /tmp/urucortinas.restore.dump /tmp/urucortinas.restore.list /tmp/urucortinas.restore.filtered.list'

log "Reapplying Prisma seed for idempotent baseline normalization."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --build --rm --no-deps --entrypoint sh backend -lc \
  'SEED_BASELINE=true RUN_PRISMA_SEED_ON_BOOT=true ENABLE_DEMO_SEED=false npm run prisma:seed >/dev/null' >/dev/null

log "Checking key row counts after restore."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  psql -U postgres -d react_admin_dashboard_test -Atc "SELECT 'Product' AS table_name, count(*) FROM \"Product\" UNION ALL SELECT 'CmsPage', count(*) FROM \"CmsPage\" UNION ALL SELECT 'User', count(*) FROM \"User\" UNION ALL SELECT 'Conversation', count(*) FROM \"Conversation\";"

log "Starting application services."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend storefront nginx >/dev/null

log "Waiting for application readiness."
LOCAL_TEST_BASE_URL="${LOCAL_TEST_BASE_URL:-http://127.0.0.1:8080}" \
  node "$REPO_ROOT/scripts/local-test-smoke.mjs"

log "Restore completed."
