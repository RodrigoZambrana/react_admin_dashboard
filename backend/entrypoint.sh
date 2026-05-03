#!/bin/sh
set -e

if [ "${LOCAL_TEST_ENV:-false}" = "true" ]; then
  export PRISMA_APPLY_MIGRATIONS="${PRISMA_APPLY_MIGRATIONS:-true}"
  export RUN_PRISMA_SEED_ON_BOOT="${RUN_PRISMA_SEED_ON_BOOT:-true}"
fi

sh ./scripts/ensure-db.sh
exec node dist/src/main.js
