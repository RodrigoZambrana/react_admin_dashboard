Place environment-specific files here. The deployment workflows will upload decrypted
secrets into the following files before running Docker Compose:

- `backend.dev.env` / `frontend.dev.env` / `storefront.dev.env` (desarrollo local)
- `backend.testing.env` / `frontend.testing.env` / `storefront.testing.env`
- `backend.prod.env` / `frontend.prod.env` / `storefront.prod.env`

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
```

Update the copied files with the values that apply to your environment.
At a minimum the backend file must define `DATABASE_URL`, authentication secrets
(`JWT_SECRET`, `COOKIE_SECRET`) and CORS settings via `ALLOWED_ORIGINS`.
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
