#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
RESET_SQL=$(mktemp /tmp/react_admin_dashboard_reset.XXXXXX.sql)

cleanup() {
  rm -f "$RESET_SQL"
}

trap cleanup EXIT

cd "$BACKEND_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required. Set it in backend/.env or export it before running this script.}"
: "${DEFAULT_ADMIN_PASSWORD:?DEFAULT_ADMIN_PASSWORD is required to create/reset the bootstrap admin.}"

DEFAULT_ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-desarrollo@software-strategy.com}"
DEFAULT_ADMIN_NAME="${DEFAULT_ADMIN_NAME:-Local Admin}"

echo "[bootstrap] Generating Prisma client..."
npx prisma generate >/dev/null

echo "[bootstrap] Recreating public schema..."
cat > "$RESET_SQL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

npx prisma db execute --url "$DATABASE_URL" --file "$RESET_SQL" >/dev/null

echo "[bootstrap] Applying official Prisma migrations..."
npx prisma migrate deploy >/dev/null

echo "[bootstrap] Seeding minimal baseline and bootstrap admin..."
SEED_BASELINE=true \
SEED_SUPERADMIN_EMAIL="$DEFAULT_ADMIN_EMAIL" \
SEED_SUPERADMIN_NAME="$DEFAULT_ADMIN_NAME" \
SEED_SUPERADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD" \
ENABLE_DEMO_SEED=false \
npx prisma db seed >/dev/null

echo "[bootstrap] Regenerating Prisma client against current schema..."
npx prisma generate >/dev/null

echo "[bootstrap] Done."
echo "[bootstrap] Admin email: $DEFAULT_ADMIN_EMAIL"
echo "[bootstrap] Baseline fixture: $BACKEND_DIR/prisma/baseline/urucortinas_minimal_baseline.json"
