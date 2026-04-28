Legacy Prisma Migration History

This folder preserves the pre-squash migration chain that existed before the
official baseline migration was introduced in:

- [backend/prisma/migrations_archive_pre_consolidation/20260323160000_squashed_baseline/migration.sql](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/prisma/migrations_archive_pre_consolidation/20260323160000_squashed_baseline/migration.sql)

Why this archive exists
- the historical chain had dependency-order issues and was not reliable for a
  clean `prisma migrate deploy` from an empty database
- the project was squashed to a single baseline migration so fresh installs can
  use the standard Prisma flow:
  - `prisma migrate deploy`
  - `prisma db seed`

Important
- Prisma does not read this archive during normal execution.
- It is kept only for historical reference and auditability.
