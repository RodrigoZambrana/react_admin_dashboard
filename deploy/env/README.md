Place environment-specific files here. The deployment workflows will upload decrypted
secrets into the following files before running Docker Compose:

- `backend.dev.env` / `frontend.dev.env` (desarrollo local)
- `backend.testing.env` / `frontend.testing.env`
- `backend.prod.env` / `frontend.prod.env`

Every environment has a matching `.example` file with the full list of required keys.
Bootstrap the real files by copying the examples and completing the values:

```bash
cp deploy/env/backend.dev.env.example deploy/env/backend.dev.env
cp deploy/env/frontend.dev.env.example deploy/env/frontend.dev.env
cp deploy/env/backend.testing.env.example deploy/env/backend.testing.env
cp deploy/env/frontend.testing.env.example deploy/env/frontend.testing.env
cp deploy/env/backend.prod.env.example deploy/env/backend.prod.env
cp deploy/env/frontend.prod.env.example deploy/env/frontend.prod.env
```

Update the copied files with the values that apply to your environment.
At a minimum the backend file must define `DATABASE_URL`, authentication secrets
(`JWT_SECRET`, `COOKIE_SECRET`) and CORS settings via `ALLOWED_ORIGINS`.
Select the tenant variant by setting `CLIENT_SLUG` in the backend file and
`VITE_CLIENT_SLUG` in the frontend file (for example `urucortinas`). Both files
default to the shared `core` configuration if the slug is omitted.
The frontend file controls Vite variables such as `VITE_API_URL`.

Run `node scripts/check-env.mjs` to validate that all `.env` files contain the keys
declared in `env.schema.json` before building or deploying.
