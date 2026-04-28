Place environment-specific files here. Local development now uses versioned baseline
files for the dev stack, with `.local` files reserved for optional overrides:

- `backend.dev.env`
- `frontend.dev.env`
- `storefront.dev.env`
- `channel-adapter.dev.env`

Optional local overlays for Docker Compose:

- `.env.backend.dev.local`
- `.env.channel-adapter.dev.local`

Deployment workflows still upload decrypted secrets into the following files before
running Docker Compose:

- `backend.dev.env` / `frontend.dev.env` / `storefront.dev.env` (desarrollo local)
- `backend.testing.env` / `frontend.testing.env` / `storefront.testing.env`
- `backend.prod.env` / `frontend.prod.env` / `storefront.prod.env`
- `channel-adapter.dev.env` (adapter de canales opcional)
- `channel-adapter.prod.env`

Every environment keeps a matching `.example` file with the full list of expected keys.
Use the examples as reference when you need to update the versioned baselines or create
non-versioned production/testing material:

```bash
cp deploy/env/backend.testing.env.example deploy/env/backend.testing.env
cp deploy/env/frontend.testing.env.example deploy/env/frontend.testing.env
cp deploy/env/storefront.testing.env.example deploy/env/storefront.testing.env
cp deploy/env/backend.prod.env.example deploy/env/backend.prod.env
cp deploy/env/frontend.prod.env.example deploy/env/frontend.prod.env
cp deploy/env/storefront.prod.env.example deploy/env/storefront.prod.env
cp deploy/env/channel-adapter.prod.env.example deploy/env/channel-adapter.prod.env
```

Update the copied files with the values that apply to your environment.
For DigitalOcean App Platform bootstrap and deploy-on-push flows, also review
[`deploy/do-app-platform-seed-reference.md`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/do-app-platform-seed-reference.md).
At a minimum the backend file must define `DATABASE_URL`, authentication secrets
(`JWT_SECRET`, `COOKIE_SECRET`) and CORS settings via `ALLOWED_ORIGINS`.
If any value contains spaces, wrap it in double quotes so the file can be safely
loaded by shells and helper scripts.

For the dev stack, do not depend on `ecommerce/.env` or other ad hoc files created in
one worktree. The canonical command is expected to resolve from the versioned files
above, with `.local` overlays used only when a developer needs an extra override.

The versioned dev compose baseline expects PostgreSQL to remain external to this stack.
By default the backend joins `${EXTERNAL_POSTGRES_NETWORK:-postgres-local}`
and resolves the database at `db:5432`, which matches the external PostgreSQL container
alias used in the local setup. If a developer needs a different target, use
`EXTERNAL_POSTGRES_NETWORK`, `DEV_DATABASE_URL` or `DEV_DB_*` via environment/local
overlay instead of editing the compose file ad hoc.
Para Docker Compose local, la variante del cliente queda centralizada en una sola
variable: `CLIENT_SLUG`. El stack deriva desde ahí:

- `CLIENT_SLUG` para backend,
- `VITE_CLIENT_SLUG` para frontend,
- `CLIENT_SLUG` y `NEXT_PUBLIC_CLIENT_SLUG` para storefront.

En desarrollo fuera de Docker, el frontend sigue leyendo `VITE_CLIENT_SLUG` desde
su `.env` local y el backend/storefront toman su `CLIENT_SLUG` desde sus propios
archivos de entorno. El frontend controla además variables de Vite como
`VITE_API_URL`, mientras que el storefront expone flags de UI
(`NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED`) y URLs de Mercado Pago.

Run `node scripts/check-env.mjs` to validate that all `.env` files contain the keys
declared in `env.schema.json` before building or deploying.

Channel adapter overlay
- the channel adapter stack should be enabled as an overlay, not mixed directly into the base compose
- use `deploy/docker-compose.channel-adapter.yml` as the channel adapter overlay file
- channel-adapter calls the canonical ai-platform through `AI_PLATFORM_BASE_URL`
- Redis remains in this overlay for adapter runtime coordination
- ai-platform owns chat runtime, channel control, and conversation state

Backend + Prisma migration flow
- Local outside Docker:
  - update `backend/prisma/schema.prisma`
  - version the migration
  - run `cd backend && npm run prisma:generate`
  - run `cd backend && npm run prisma:migrate`
- Docker local:
  - `deploy/docker-compose.dev.yml` runs `npx prisma migrate deploy` automatically before starting the backend container
  - set `SKIP_PRISMA_MIGRATIONS=true` only for exceptional cases
- Testing/production:
  - deploy only versioned migrations
  - keep `PRISMA_APPLY_MIGRATIONS=true`
  - avoid manual schema edits directly in the database
