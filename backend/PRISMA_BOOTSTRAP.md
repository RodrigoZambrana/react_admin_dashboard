Prisma Bootstrap and Squashed Baseline

Purpose
- Keep the project aligned with the standard Prisma operational model:
  - `prisma generate`
  - `prisma migrate deploy`
  - `prisma db seed`
- Ensure a clean installation can start from zero without manual SQL restores.

Current official strategy
- The active migration history is squashed into a single baseline migration:
  - [backend/prisma/migrations/20260323160000_squashed_baseline/migration.sql](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/migrations/20260323160000_squashed_baseline/migration.sql)
- The historical pre-squash chain is archived for reference only:
  - [backend/prisma/migrations_archive_pre_squash/README.md](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/migrations_archive_pre_squash/README.md)
- Baseline data for `urucortinas` is seeded through Prisma:
  - [backend/prisma/baseline/urucortinas_minimal_baseline.json](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/baseline/urucortinas_minimal_baseline.json)
  - [backend/prisma/baseline/seed-baseline.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/baseline/seed-baseline.ts)

What this means operationally

Fresh installation
1. `prisma migrate deploy`
2. `prisma db seed`

Existing installation that already lived through the old migration history
1. run a one-time official Prisma resolve:
   - `npm run prisma:resolve:squashed-baseline`
   - or `npx prisma migrate resolve --applied 20260323160000_squashed_baseline`
2. then continue normally with:
   - `prisma migrate deploy`
   - `prisma db seed` when needed

Why the resolve step exists
- Existing databases already contain the schema produced by the old history.
- After squashing, Prisma needs to know that the new baseline migration should be considered already applied on those installations.
- `migrate resolve` is the standard Prisma mechanism for that transition.

Why this is closer to standard Prisma
- No runtime dependency on restoring schema dumps.
- No custom migration ledger rebuilding.
- Clean installs use the official migration engine.
- Baseline/reference data lives in Prisma seed code, not in ad hoc restore scripts.

What the seed baseline contains
- product categories
- products
- product images
- shipping option(s)
- company profile
- email templates/settings
- notification settings/rules
- calendar event types
- system config
- `abertura_glossary_items`
- `dimension_price_matrix`
- bootstrap superadmin when explicit credentials are provided

What the seed baseline intentionally excludes
- `SecureConfig`
  - encrypted operational secrets must be configured per environment
- transactional/flow data
  - customers
  - orders
  - payments
  - storefront payment intents
  - notifications
  - email logs
  - inbox content
  - wishlists
  - work orders / production orders

Scalability rule for future changes
1. Change [schema.prisma](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/schema.prisma).
2. Create a new Prisma migration on top of the squashed baseline.
3. If the feature needs day-0 reference rows on a clean install, update the Prisma seed baseline.
4. Keep the seed idempotent.

Payment methods: static catalog vs table

Current design
- `PaymentMethod` is not a database table.
- The canonical catalog lives in:
  - [backend/src/common/constants/payment-methods.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/common/constants/payment-methods.ts)

Recommendation
- Keep payment methods static for now.
- They are a tiny controlled catalog and do not justify extra schema/seed/runtime complexity yet.
- Revisit a table only if the business needs admin-managed catalogs, tenant-specific methods, or richer per-method metadata.
