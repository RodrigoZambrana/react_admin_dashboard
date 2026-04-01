#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$REPO_ROOT/deploy/docker-compose.postgres-local.yml"

POSTGRES_STACK_NAME="${POSTGRES_STACK_NAME:-postgres-local}"
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-postgres-local}"
POSTGRES_VOLUME_NAME="${POSTGRES_VOLUME_NAME:-postgres-local}"
POSTGRES_NETWORK_NAME="${POSTGRES_NETWORK_NAME:-postgres-local}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5432}"
POSTGRES_MIGRATION_HOST_PORT="${POSTGRES_MIGRATION_HOST_PORT:-55432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-react_admin_dashboard}"
LEGACY_POSTGRES_CONTAINER_NAME="${LEGACY_POSTGRES_CONTAINER_NAME:-admin-dashboard-dev-db-1}"
BACKUP_DIR="$REPO_ROOT/backups/db"

compose() {
  PORT="$1"
  shift
  POSTGRES_STACK_NAME="$POSTGRES_STACK_NAME" \
  POSTGRES_CONTAINER_NAME="$POSTGRES_CONTAINER_NAME" \
  POSTGRES_VOLUME_NAME="$POSTGRES_VOLUME_NAME" \
  POSTGRES_NETWORK_NAME="$POSTGRES_NETWORK_NAME" \
  POSTGRES_HOST_PORT="$PORT" \
  docker compose -f "$COMPOSE_FILE" "$@"
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -Fx "$1" >/dev/null 2>&1
}

container_running() {
  docker ps --format '{{.Names}}' | grep -Fx "$1" >/dev/null 2>&1
}

volume_exists() {
  docker volume inspect "$1" >/dev/null 2>&1
}

wait_ready() {
  CONTAINER_NAME="$1"
  ATTEMPTS=0
  while [ "$ATTEMPTS" -lt 60 ]; do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    sleep 2
  done
  echo "[ensure-postgres-local] PostgreSQL did not become ready in time." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"

if container_exists "$POSTGRES_CONTAINER_NAME"; then
  compose "$POSTGRES_HOST_PORT" up -d
  wait_ready "$POSTGRES_CONTAINER_NAME"
  printf '[ensure-postgres-local] using existing %s\n' "$POSTGRES_CONTAINER_NAME"
  exit 0
fi

if volume_exists "$POSTGRES_VOLUME_NAME"; then
  compose "$POSTGRES_HOST_PORT" up -d
  wait_ready "$POSTGRES_CONTAINER_NAME"
  printf '[ensure-postgres-local] started %s from existing volume %s\n' "$POSTGRES_CONTAINER_NAME" "$POSTGRES_VOLUME_NAME"
  exit 0
fi

if ! container_exists "$LEGACY_POSTGRES_CONTAINER_NAME"; then
  compose "$POSTGRES_HOST_PORT" up -d
  wait_ready "$POSTGRES_CONTAINER_NAME"
  printf '[ensure-postgres-local] started empty %s\n' "$POSTGRES_CONTAINER_NAME"
  exit 0
fi

if ! container_running "$LEGACY_POSTGRES_CONTAINER_NAME"; then
  printf '[ensure-postgres-local] starting stopped legacy container %s\n' "$LEGACY_POSTGRES_CONTAINER_NAME"
  docker start "$LEGACY_POSTGRES_CONTAINER_NAME" >/dev/null
  wait_ready "$LEGACY_POSTGRES_CONTAINER_NAME"
fi

BACKUP_FILE="$BACKUP_DIR/react_admin_dashboard_$(date +%Y%m%d_%H%M%S)_legacy_postgres_local.sql"

printf '[ensure-postgres-local] exporting legacy database from %s to %s\n' "$LEGACY_POSTGRES_CONTAINER_NAME" "$BACKUP_FILE"
docker exec -u postgres "$LEGACY_POSTGRES_CONTAINER_NAME" \
  pg_dump -U "$POSTGRES_USER" --clean --if-exists --create "$POSTGRES_DB" > "$BACKUP_FILE"

printf '[ensure-postgres-local] booting temporary %s on port %s for restore\n' "$POSTGRES_CONTAINER_NAME" "$POSTGRES_MIGRATION_HOST_PORT"
compose "$POSTGRES_MIGRATION_HOST_PORT" up -d
wait_ready "$POSTGRES_CONTAINER_NAME"

printf '[ensure-postgres-local] restoring logical dump into %s\n' "$POSTGRES_CONTAINER_NAME"
cat "$BACKUP_FILE" | docker exec -i "$POSTGRES_CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres >/dev/null

TABLE_COUNT=$(docker exec "$POSTGRES_CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
if [ "${TABLE_COUNT:-0}" -eq 0 ]; then
  echo "[ensure-postgres-local] restore verification failed: public schema has no tables." >&2
  exit 1
fi

printf '[ensure-postgres-local] legacy data restored with %s public tables\n' "$TABLE_COUNT"

compose "$POSTGRES_MIGRATION_HOST_PORT" down

printf '[ensure-postgres-local] stopping legacy container %s\n' "$LEGACY_POSTGRES_CONTAINER_NAME"
docker stop "$LEGACY_POSTGRES_CONTAINER_NAME" >/dev/null
docker rm "$LEGACY_POSTGRES_CONTAINER_NAME" >/dev/null

printf '[ensure-postgres-local] starting canonical %s on port %s\n' "$POSTGRES_CONTAINER_NAME" "$POSTGRES_HOST_PORT"
compose "$POSTGRES_HOST_PORT" up -d
wait_ready "$POSTGRES_CONTAINER_NAME"

printf '[ensure-postgres-local] ready with volume %s and backup %s\n' "$POSTGRES_VOLUME_NAME" "$BACKUP_FILE"
