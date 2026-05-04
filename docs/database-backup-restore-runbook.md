# Database Backup and Restore Runbook

This project uses PostgreSQL as the source of truth for the application data. The standard process for a real backup and restore must be logical, reproducible, and documented.

## Goals

- Create a trustworthy logical backup of the live PostgreSQL database.
- Rebuild a target database from a clean, consolidated Prisma schema.
- Restore real business data into that clean schema.
- Reapply the Prisma seed as an idempotent normalization step.
- Boot the full app and validate the result.

## Backup format

- Use `pg_dump -Fc`.
- Store the result outside the repository.
- Validate each dump with `pg_restore -l` before considering it usable.

## Standard backup command

```bash
make backup
```

Equivalent manual command:

```bash
BACKUP_OUT_DIR="$HOME/Documents/UrucortinasBackups" \
POSTGRES_CONTAINER_NAME=postgres-local \
POSTGRES_USER=postgres \
POSTGRES_DB=react_admin_dashboard \
sh scripts/backup-postgres-real.sh
```

Outputs:

- `<database>_<timestamp>_from_<container>.dump`
- `<database>_<timestamp>_from_<container>.manifest.txt`
- `<database>_<timestamp>_from_<container>.sha256`
- `latest.dump`
- `latest.manifest.txt`
- `latest.sha256`

## Standard restore flow

The restore flow used by the local test environment is:

1. Destroy the target local test database volume.
2. Start the target database container.
3. Apply the consolidated Prisma schema from scratch.
4. Restore the real data dump with `pg_restore`.
5. Reapply Prisma seed for idempotent normalization.
6. Boot backend, frontend, storefront, and reverse proxy.
7. Run smoke tests.

Equivalent command:

```bash
make local-test-restore
```

## Why the schema bootstrap is separate

The repository already keeps a consolidated Prisma baseline:

- `backend/prisma/migrations/20260428170000_consolidated_baseline/migration.sql`

That means a clean installation does not need the historical migration chain. The schema bootstrap step is therefore:

```bash
npm run bootstrap:schema:local -- --confirm
```

This:

- drops `public`
- reapplies the consolidated Prisma baseline
- regenerates the Prisma client
- does **not** seed data

## Why the dump is restored as data-only

The live database backup includes the real application state, but the clean target database should keep the consolidated migration ledger created by Prisma. To avoid conflicts with `_prisma_migrations`, the restore step uses:

```bash
pg_restore --data-only --disable-triggers --no-owner --no-privileges --exclude-table=_prisma_migrations
```

This keeps the schema bootstrap authoritative and uses the dump only for data.

## Normalization after restore

After the restore, run the Prisma seed:

```bash
SEED_BASELINE=true RUN_PRISMA_SEED_ON_BOOT=true ENABLE_DEMO_SEED=false npm run prisma:seed
```

This keeps the baseline idempotent and repairs missing fixture rows or sequence values when needed.

## Validation checklist

After restore, validate:

- `/api/health` returns `200`
- `/` returns the storefront HTML
- `/admin` returns the admin HTML
- critical images load from `/media` and `/uploads`
- counts are consistent for:
  - `User`
  - `Product`
  - `CmsPage`
  - `Conversation`

## Safety rules

- Never restore into a production target without an explicit backup first.
- Never use the historical `.sql.gz` dump as the preferred path once the custom `.dump` backup exists.
- Never use ad hoc SQL during the restore flow if a Prisma or scripted step exists.

## Troubleshooting

- If `pg_restore` fails, validate the archive with `pg_restore -l <file>`.
- If Prisma seed fails because of environment differences, verify the local test env vars in `.env.test`.
- If the app boots but content is incomplete, inspect the dump source and confirm it came from the live `postgres-local` instance.

## Recovery note from the May 3 run

The first custom archive generated from `postgres-local` on `20260503_221838` turned out to be an incomplete/empty snapshot for the business data we needed. The actual Urucortinas content was recovered from the earlier logical SQL archive during this one-time incident response:

- `react_admin_dashboard_20260503_140510_from_postgres-local.sql.gz`

That archive was restored into the local test database, and only then was the canonical custom dump regenerated as:

- `latest.dump`

This runbook now treats the custom `.dump` as the only standard restore artifact. The legacy SQL archive is retained only as an incident record and must not be used in the operational restore flow.
