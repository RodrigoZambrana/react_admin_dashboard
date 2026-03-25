Place environment-specific files here. The deployment workflows will upload decrypted
secrets into the following files before running Docker Compose:

- `backend.dev.env` / `frontend.dev.env` / `storefront.dev.env` (desarrollo local)
- `backend.testing.env` / `frontend.testing.env` / `storefront.testing.env`
- `backend.prod.env` / `frontend.prod.env` / `storefront.prod.env`
- `ai-agent.dev.env` / `channel-adapter.dev.env` (stack AI opcional)
- `ai-agent.prod.env` / `channel-adapter.prod.env`

Every environment has a matching `.example` file with the full list of required keys.
Bootstrap the real files by copying the examples and completing the values:

```bash
cp deploy/env/backend.dev.env.example deploy/env/backend.dev.env
cp deploy/env/frontend.dev.env.example deploy/env/frontend.dev.env
cp deploy/env/storefront.dev.env.example deploy/env/storefront.dev.env
cp deploy/env/backend.testing.env.example deploy/env/backend.testing.env
cp deploy/env/frontend.testing.env.example deploy/env/frontend.testing.env
cp deploy/env/storefront.testing.env.example deploy/env/storefront.testing.env
cp deploy/env/backend.prod.env.example deploy/env/backend.prod.env
cp deploy/env/frontend.prod.env.example deploy/env/frontend.prod.env
cp deploy/env/storefront.prod.env.example deploy/env/storefront.prod.env
cp deploy/env/ai-agent.dev.env.example deploy/env/ai-agent.dev.env
cp deploy/env/channel-adapter.dev.env.example deploy/env/channel-adapter.dev.env
cp deploy/env/ai-agent.prod.env.example deploy/env/ai-agent.prod.env
cp deploy/env/channel-adapter.prod.env.example deploy/env/channel-adapter.prod.env
```

Update the copied files with the values that apply to your environment.
At a minimum the backend file must define `DATABASE_URL`, authentication secrets
(`JWT_SECRET`, `COOKIE_SECRET`) and CORS settings via `ALLOWED_ORIGINS`.
If any value contains spaces, wrap it in double quotes so the file can be safely
loaded by shells and helper scripts.
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

AI optional stack
- the AI stack should be enabled as an overlay, not mixed directly into the base compose
- use `deploy/docker-compose.ai-agent.yml` as the starting point
- Redis should be enabled from the first AI-capable stack execution
- keep Postgres outside this overlay, as it is today, so database lifecycle, backup and recovery remain independent
- production should run with Redis using:
  - `AI_MEMORY_DRIVER=redis`
  - `REDIS_ENABLED=true`

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
