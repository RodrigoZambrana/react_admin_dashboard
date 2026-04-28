Legacy Prisma Migration History

This folder preserves the migration chain that was active before the current
consolidated baseline was introduced in:

- [backend/prisma/migrations/20260428170000_consolidated_baseline/migration.sql](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/prisma/migrations/20260428170000_consolidated_baseline/migration.sql)

Why this archive exists
- the active migration history was consolidated into a single baseline so fresh
  installs can use the standard Prisma flow with a much smaller migration set
- the historical chain is kept only for auditability and rollback analysis

Important
- Prisma does not read this archive during normal execution.
- It is kept only for historical reference.
