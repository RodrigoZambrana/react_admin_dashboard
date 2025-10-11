#!/bin/sh
set -e

HOST="${DB_HOST:-db}"
PORT="${DB_PORT:-5432}"
USER="${DB_USER:-postgres}"
PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-react_admin_dashboard}"

export PGPASSWORD="$PASSWORD"

echo "Waiting for PostgreSQL at ${HOST}:${PORT}..."
until psql -h "$HOST" -p "$PORT" -U "$USER" -c '\q' >/dev/null 2>&1; do
  echo "PostgreSQL not ready yet, retrying in 2s..."
  sleep 2
done

DB_EXISTS=$(psql -h "$HOST" -p "$PORT" -U "$USER" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
if [ "$DB_EXISTS" != "1" ]; then
  echo "Database ${DB_NAME} not found. Creating..."
  psql -h "$HOST" -p "$PORT" -U "$USER" -c "CREATE DATABASE \"${DB_NAME}\""
else
  echo "Database ${DB_NAME} already exists."
fi

if [ "${SKIP_PRISMA_MIGRATIONS:-false}" != "true" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy || {
    echo "Prisma migrations failed; exiting."
    exit 1
  }
else
  echo "Skipping Prisma migrations (SKIP_PRISMA_MIGRATIONS=true)."
fi

if [ "${RUN_PRISMA_SEED_ON_BOOT:-false}" = "true" ]; then
  echo "Running Prisma seed..."
  npx prisma db seed || {
    echo "Prisma seed failed; exiting."
    exit 1
  }
else
  echo "Skipping Prisma seed (RUN_PRISMA_SEED_ON_BOOT!=true)."
fi
