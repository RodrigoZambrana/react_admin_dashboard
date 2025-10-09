Place environment-specific files here. The deployment workflows will upload decrypted
secrets into the following files before running Docker Compose:

- backend.dev.env / frontend.dev.env (local overrides if required)
- backend.staging.env / frontend.staging.env
- backend.prod.env / frontend.prod.env

For local development the Compose file expects `backend.dev.env` and `frontend.dev.env`.
You can bootstrap them from the provided examples:

```bash
cp deploy/env/backend.dev.env.example deploy/env/backend.dev.env
cp deploy/env/frontend.dev.env.example deploy/env/frontend.dev.env
```

Update the copied files with the values that apply to your environment.
At a minimum the backend file must define `DATABASE_URL`, authentication secrets
(`JWT_SECRET`, `COOKIE_SECRET`) and CORS settings via `ALLOWED_ORIGINS`.
The frontend file controls Vite variables such as `VITE_API_URL`.
