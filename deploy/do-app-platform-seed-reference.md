# DigitalOcean App Platform bootstrap reference

This file documents the variables that must exist in DigitalOcean App Platform
for a clean deploy on push to the `deploy_digital_ocean_and_github` branch.

The seed is bootstrap-only:
- it materializes defaults when a value is missing
- it respects anything already managed from the admin UI
- it does not store real secrets in the repository

## Required runtime variables

These must be set in the App Platform service environment or secret manager:

- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `CONFIG_ENCRYPTION_KEY`
- `DEFAULT_ALLOWED_ORIGINS`
- `ALLOWED_ORIGINS`
- `NEXT_PUBLIC_SITE_URL`
- `CLIENT_SLUG`
- `NODE_ENV`
- `PORT`

## Bootstrap variables for initial seed

These are consumed by the seed and should be present when the system starts from
an empty database:

- `RUN_PRISMA_SEED_ON_BOOT=true`
- `ENABLE_DEMO_SEED=false`
- `SEED_SUPERADMIN_EMAIL`
- `SEED_SUPERADMIN_PASSWORD`
- `SEED_SUPERADMIN_NAME`
- `SEED_SUPERADMIN_FIRST_NAME`
- `SEED_SUPERADMIN_LAST_NAME`
- `SEED_USER_PASSWORD`
- `DEFAULT_USER_TEMP_PASSWORD`
- `STOREFRONT_GENERIC_CUSTOMER_PASSWORD`

## Optional but recommended operational variables

- `PRISMA_APPLY_MIGRATIONS=true`
- `SESSION_TTL_HOURS`
- `PAYMENTS_PROVIDER`
- `MP_PUBLIC_KEY`
- `MP_ACCESS_TOKEN`
- `MP_COUNTRY`
- `MP_TIMEOUT_MS`
- `EMAIL_PROVIDER`
- `EMAIL_FROM_DEFAULT`
- `EMAIL_FROM_NAME_DEFAULT`
- `GOOGLE_OAUTH_ENABLED`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `RECAPTCHA_ENABLED`
- `RECAPTCHA_SECRET_KEY`
- `ADMIN_RECAPTCHA_ENABLED`
- `ADMIN_RECAPTCHA_SITE_KEY`
- `STOREFRONT_RECAPTCHA_ENABLED`
- `STOREFRONT_RECAPTCHA_SITE_KEY`
- `SENTRY_DSN`

## Notes

- Keep secrets in DigitalOcean, not in the repository.
- The backend `entrypoint.sh` runs database bootstrap and then starts Nest.
- `RUN_PRISMA_SEED_ON_BOOT=true` is safe for repeat deploys because the seed is idempotent.
- If you later disable bootstrap seed, the system will still start, but a clean database
  may remain incomplete until the seed is run manually.
