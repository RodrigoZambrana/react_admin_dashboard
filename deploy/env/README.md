Place environment-specific files here. The deployment workflows will upload decrypted
secrets into the following files before running Docker Compose:

- backend.dev.env / frontend.dev.env (local overrides if required)
- backend.staging.env / frontend.staging.env
- backend.prod.env / frontend.prod.env

These files must define DATABASE_URL, JWT secrets, and any runtime configuration.
