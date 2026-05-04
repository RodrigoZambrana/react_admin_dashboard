# Production / Testing Environment Contract

This file is the deployment contract for the Docker-based `prod` and `testing`
stacks. It documents:

- the full set of environment variables used by the system
- which values differ between `prod` and `testing`
- which variables are shared but still required

The canonical sources of truth are:

- [`deploy/docker-compose.prod.yml`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/docker-compose.prod.yml)
- [`deploy/docker-compose.testing.yml`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/docker-compose.testing.yml)
- [`deploy/env/backend.prod.env`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/env/backend.prod.env)
- [`deploy/env/backend.testing.env`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/env/backend.testing.env)
- [`deploy/env/frontend.prod.env`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/env/frontend.prod.env)
- [`deploy/env/frontend.testing.env`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/env/frontend.testing.env)
- [`deploy/env/storefront.prod.env`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/env/storefront.prod.env)
- [`deploy/env/storefront.testing.env`](/Users/rodrigo/Git/personal/react_admin_dashboard/deploy/env/storefront.testing.env)

## What changes between `prod` and `testing`

The topology is the same in both environments:

- one public reverse proxy
- internal `frontend`, `backend`, `storefront`, `redis`
- external PostgreSQL

The values that change are mainly the public origin, test/prod feature flags,
and environment-specific secrets.

### Compose / ingress

| Variable | Prod | Testing | Notes |
| --- | --- | --- | --- |
| `APP_DOMAIN_*` | `midominio.com` | `testing.example.com` | Public host served by the reverse proxy. |
| `SERVER_NAME` | `midominio.com` | `testing.example.com` | Passed to the reverse proxy container. |

### Admin frontend

| Variable | Prod | Testing | Notes |
| --- | --- | --- | --- |
| `VITE_APP_NAME` | `Sistema Administrativo` | `Sistema Administrativo (Testing)` | Visible application label. |
| `VITE_API_URL` | `/api` | `/api` | Same-origin API path in both envs. |
| `VITE_APP_PREFIX_PATH` | `/admin` | `/admin` | Kept identical so the admin stays under the same namespace. |
| `VITE_STATE_SIGNATURE_KEY` | prod-specific value | testing-specific value | Must differ per environment. |
| `VITE_RECAPTCHA_ENABLED` | `false` | `false` | Same baseline right now. |
| `VITE_RECAPTCHA_SITE_KEY` | empty or secret | empty or secret | Only needed if reCAPTCHA is enabled. |
| `VITE_PARAMETRIC_IMPORT_TIMEOUT_MS` | `120000` | `120000` | Same baseline. |
| `VITE_CLIENT_SLUG` | `core` | `core` | Same by default, but tenant-specific builds may differ. |

### Storefront

| Variable | Prod | Testing | Notes |
| --- | --- | --- | --- |
| `CLIENT_SLUG` | `core` | `core` | Same by default. |
| `NEXT_PUBLIC_CLIENT_SLUG` | `core` | `core` | Same by default. |
| `NEXT_PUBLIC_STOREFRONT_API_URL` | `/api/storefront` | `/api/storefront` | Browser uses same-origin path. |
| `STOREFRONT_API_URL` | `http://backend:3000/api/storefront` | `http://backend:3000/api/storefront` | Server-side internal URL. |
| `NEXT_PUBLIC_AUTH_API_URL` | `/api` | `/api` | Browser same-origin path. |
| `AUTH_API_URL` | `http://backend:3000/api` | `http://backend:3000/api` | Server-side internal URL. |
| `NEXT_PUBLIC_ANALYTICS_API_URL` | `/api/analytics` | `/api/analytics` | Browser same-origin path. |
| `ANALYTICS_API_URL` | `http://backend:3000/api/analytics` | `http://backend:3000/api/analytics` | Server-side internal URL. |
| `NEXT_PUBLIC_SITE_URL` | `https://midominio.com` | `https://testing.example.com` | Public storefront origin. |
| `NEXT_PUBLIC_STOREFRONT_HOME_PATH` | `/` | `/` | Same baseline. |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | `/media` | `/media` | Public media path. |
| `NEXT_PUBLIC_MEDIA_PROVIDER` | `local` | `local` | Same baseline while media stays in the droplet storage. |
| `NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED` | `true` | `false` | Different feature flag by environment. |
| `NEXT_PUBLIC_ENABLE_STOREFRONT_MOCKS` | `false` | `false` | Must remain off outside dev. |
| `ENABLE_STOREFRONT_MOCKS` | `false` | `false` | Must remain off outside dev. |
| `NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS` | `false` | `false` | Must remain off outside dev. |
| `ENABLE_STOREFRONT_FALLBACKS` | `false` | `false` | Must remain off outside dev. |
| `NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS` | `false` | `false` | Must remain off outside dev. |
| `NEXT_PUBLIC_STOREFRONT_FAIL_FAST` | `false` | `false` | Same baseline. |
| `STOREFRONT_FAIL_FAST` | `false` | `false` | Same baseline. |
| `NEXT_PUBLIC_STORE_LOCALE` | `es-UY` | `es-UY` | Same baseline. |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | secret or empty | secret or empty | Environment-specific. |
| `NEXT_PUBLIC_MP_COUNTRY` | `UY` | `UY` | Same baseline now. |
| `NEXT_PUBLIC_MP_SUCCESS_URL` | `/payment/success` | `/payment/success` | Same baseline. |
| `NEXT_PUBLIC_MP_FAILURE_URL` | `/payment/error` | `/payment/error` | Same baseline. |
| `NEXT_PUBLIC_RECOVERY_MODE` | empty | empty | Same baseline. |
| `NEXT_PUBLIC_VENDOR_FAIL_FAST` | `false` | `false` | Same baseline. |
| `NEXT_PUBLIC_SHOP_LIST_FAIL_FAST` | `false` | `false` | Same baseline. |
| `SNAPSHOT_ACCESS_TOKEN` | secret or empty | secret or empty | Only needed for snapshot fallbacks. |

### Backend

| Variable | Prod | Testing | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | `production` | Same runtime mode. |
| `PORT` | `3000` | `3000` | Same internal port. |
| `CLIENT_SLUG` | `core` | `core` | Same by default. |
| `DATABASE_URL` | external PostgreSQL host | external PostgreSQL host | Must point to the real DO database host. |
| `REDIS_URL` | `redis://redis:6379` | `redis://redis:6379` | Internal Redis only. |
| `ANALYTICS_QUEUE_URL` | `redis://redis:6379` | `redis://redis:6379` | Internal Redis queue. |
| `QUEUE_REDIS_URL` | `redis://redis:6379` | `redis://redis:6379` | Internal Redis queue. |
| `AUTH_REDIS_URL` | `redis://redis:6379` | `redis://redis:6379` | Internal Redis cache/rate limit. |
| `ANALYTICS_QUEUE_NAME` | `analytics-pipeline` | `analytics-pipeline` | Same baseline. |
| `ANALYTICS_HEALTH_*` | same baseline | same baseline | Monitoring thresholds and timings. |
| `ANALYTICS_DATA_TRUST_*` | same baseline | same baseline | Data-quality thresholds. |
| `DEFAULT_ALLOWED_ORIGINS` | `https://midominio.com` | `https://testing.example.com` | Must match public ingress. |
| `ALLOWED_ORIGINS` | `https://midominio.com` | `https://testing.example.com` | Must match public ingress. |
| `NEXT_PUBLIC_SITE_URL` | `https://midominio.com` | `https://testing.example.com` | Must match the public store origin. |
| `JWT_SECRET` | prod secret | testing secret | Must differ. |
| `COOKIE_SECRET` | prod secret | testing secret | Must differ. |
| `SESSION_TTL_HOURS` | `168` | `168` | Same baseline. |
| `CUSTOMER_PASSWORD_RESET_*` | same baseline | same baseline | Same baseline. |
| `CUSTOMER_PASSWORD_OTP_*` | same baseline | same baseline | Same baseline. |
| `RECAPTCHA_ENABLED` | `false` | `false` | Same baseline. |
| `RECAPTCHA_SECRET_KEY` | secret or empty | secret or empty | Only if enabled. |
| `GOOGLE_CLIENT_ID` | secret or empty | secret or empty | Environment-specific. |
| `GOOGLE_CLIENT_SECRET` | secret or empty | secret or empty | Environment-specific. |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://midominio.com/api/storefront/auth/google/callback` | `https://testing.example.com/api/storefront/auth/google/callback` | Must match public origin. |
| `STOREFRONT_COOKIE_SECURE` | `true` | `true` | Same baseline. |
| `STOREFRONT_COOKIE_SAMESITE` | `lax` | `lax` | Same baseline. |
| `STOREFRONT_COOKIE_DOMAIN` | empty | empty | Same baseline unless you need a parent domain cookie. |
| `AUTH_PASSWORD_RESET_URL` | `https://midominio.com/auth/reset-password` | `https://testing.example.com/auth/reset-password` | Must match public origin. |
| `DEFAULT_USER_TEMP_PASSWORD` | prod secret | testing secret | Must differ. |
| `STOREFRONT_GENERIC_CUSTOMER_PASSWORD` | shared secret or testing secret | shared secret or testing secret | Must be explicit. |
| `SMS_PROVIDER` | `textbee` | `textbee` | Same baseline. |
| `TEXTBEE_*` | secrets or empty | secrets or empty | Environment-specific. |
| `AUTH_OTP_*` | same baseline | same baseline | Same baseline. |
| `RUN_PRISMA_SEED_ON_BOOT` | `false` | `false` | Controlled by the compose/bootstrap flow. |
| `ENABLE_DEMO_SEED` | `false` | `false` | Must remain off in real envs. |
| `DEFAULT_ADMIN_EMAIL` | `desarrollo@software-strategy.com` | `desarrollo@software-strategy.com` | Same baseline. |
| `DEFAULT_ADMIN_NAME` | `Prod Admin` | `Testing Admin` | Different bootstrap label. |
| `DEFAULT_ADMIN_PASSWORD` | secret or empty | secret or empty | Environment-specific. |
| `SEED_SUPERADMIN_EMAIL` | secret or empty | secret or empty | Environment-specific. |
| `SEED_SUPERADMIN_PASSWORD` | secret or empty | secret or empty | Environment-specific. |
| `SEED_SUPERADMIN_NAME` | `Prod Admin` | `Testing Admin` | Different bootstrap label. |
| `SEED_SUPERADMIN_FIRST_NAME` | empty | empty | Same baseline. |
| `SEED_SUPERADMIN_LAST_NAME` | empty | empty | Same baseline. |
| `SEED_USER_PASSWORD` | secret or empty | secret or empty | Environment-specific. |
| `PRISMA_APPLY_MIGRATIONS` | `true` in deploy flow | `true` in deploy flow | Same intent: apply migrations on boot. |
| `PRISMA_QUERY_TIMEOUT_MS` | `20000` | `20000` | Same baseline. |
| `PARAMETRIC_IMPORT_TIMEOUT_MS` | `120000` | `120000` | Same baseline. |
| `SENTRY_DSN` | secret or empty | secret or empty | Environment-specific. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | `0` | Same baseline. |
| `EMAIL_PROVIDER` | `SMTP` | `DEV` | Different by environment. |
| `EMAIL_SMTP_*` | SMTP secrets/config | usually empty | Production uses real SMTP; testing can stay empty. |
| `EMAIL_FROM_DEFAULT` | `no-reply@example.com` | `no-reply@example.com` | Same baseline. |
| `EMAIL_FROM_NAME_DEFAULT` | `Sistema Administrativo` | `Sistema Administrativo` | Same baseline. |
| `INBOX_EMAIL_*` | secrets/config | usually empty | Only if inbox ingestion is enabled. |
| `PAYMENTS_PROVIDER` | `mercadopago` | `mercadopago` | Same baseline. |
| `MP_*` | secrets/config | secrets/config | Environment-specific. |
| `CONFIG_ENCRYPTION_KEY` | prod secret | testing secret | Must differ. |
| `GOOGLE_OAUTH_ENABLED` | `true` | `true` | Same baseline. |
| `ADMIN_RECAPTCHA_ENABLED` | `false` | `false` | Same baseline. |
| `ADMIN_RECAPTCHA_SITE_KEY` | secret or empty | secret or empty | Only if enabled. |
| `STOREFRONT_RECAPTCHA_ENABLED` | `false` | `false` | Same baseline. |
| `STOREFRONT_RECAPTCHA_SITE_KEY` | secret or empty | secret or empty | Only if enabled. |

## Full variable catalog by service

This section groups every required key by service so it is easy to compare files.

### Reverse proxy / compose

These are the deployment-level variables that steer the ingress layer:

- `APP_DOMAIN_PROD`
- `APP_DOMAIN_TESTING`
- `SERVER_NAME`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `FRONTEND_HOST`
- `FRONTEND_PORT`
- `STOREFRONT_HOST`
- `STOREFRONT_PORT`

They are the only values that should change the public hostname and the routing
target for the reverse proxy.

### Frontend admin

Required keys:

- `VITE_APP_NAME`
- `VITE_API_URL`
- `VITE_APP_PREFIX_PATH`
- `VITE_CLIENT_SLUG`
- `VITE_STATE_SIGNATURE_KEY`
- `VITE_RECAPTCHA_ENABLED`
- `VITE_RECAPTCHA_SITE_KEY`
- `VITE_PARAMETRIC_IMPORT_TIMEOUT_MS`

Recommended defaults for the current production/testing topology:

- `VITE_API_URL=/api`
- `VITE_APP_PREFIX_PATH=/admin`
- `VITE_CLIENT_SLUG=core`

### Storefront

Required keys:

- `CLIENT_SLUG`
- `NEXT_PUBLIC_CLIENT_SLUG`
- `NEXT_PUBLIC_STOREFRONT_API_URL`
- `STOREFRONT_API_URL`
- `NEXT_PUBLIC_AUTH_API_URL`
- `AUTH_API_URL`
- `NEXT_PUBLIC_ANALYTICS_API_URL`
- `ANALYTICS_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STOREFRONT_HOME_PATH`
- `NEXT_PUBLIC_MEDIA_BASE_URL`
- `NEXT_PUBLIC_MEDIA_PROVIDER`
- `NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED`
- `NEXT_PUBLIC_ENABLE_STOREFRONT_MOCKS`
- `ENABLE_STOREFRONT_MOCKS`
- `NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS`
- `ENABLE_STOREFRONT_FALLBACKS`
- `NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS`
- `NEXT_PUBLIC_STOREFRONT_FAIL_FAST`
- `STOREFRONT_FAIL_FAST`
- `NEXT_PUBLIC_STORE_LOCALE`
- `NEXT_PUBLIC_MP_PUBLIC_KEY`
- `NEXT_PUBLIC_MP_COUNTRY`
- `NEXT_PUBLIC_MP_SUCCESS_URL`
- `NEXT_PUBLIC_MP_FAILURE_URL`
- `NEXT_PUBLIC_RECOVERY_MODE`
- `NEXT_PUBLIC_VENDOR_FAIL_FAST`
- `NEXT_PUBLIC_SHOP_LIST_FAIL_FAST`
- `SNAPSHOT_ACCESS_TOKEN`

Recommended defaults for the current topology:

- `NEXT_PUBLIC_STOREFRONT_API_URL=/api/storefront`
- `STOREFRONT_API_URL=http://backend:3000/api/storefront`
- `NEXT_PUBLIC_AUTH_API_URL=/api`
- `AUTH_API_URL=http://backend:3000/api`
- `NEXT_PUBLIC_ANALYTICS_API_URL=/api/analytics`
- `ANALYTICS_API_URL=http://backend:3000/api/analytics`
- `NEXT_PUBLIC_SITE_URL=https://midominio.com` or `https://testing.example.com`
- `NEXT_PUBLIC_MEDIA_BASE_URL=/media`
- `NEXT_PUBLIC_MEDIA_PROVIDER=local`

### Backend

Required keys:

- `NODE_ENV`
- `PORT`
- `CLIENT_SLUG`
- `DATABASE_URL`
- `REDIS_URL`
- `ANALYTICS_QUEUE_URL`
- `QUEUE_REDIS_URL`
- `AUTH_REDIS_URL`
- `ANALYTICS_QUEUE_NAME`
- `ANALYTICS_HEALTH_MODE`
- `ANALYTICS_HEALTH_INTERVAL_MINUTES`
- `ANALYTICS_HEALTH_SUMMARY_INTERVAL_MINUTES`
- `ANALYTICS_HEALTH_DIGEST_WINDOW_HOURS`
- `ANALYTICS_HEALTH_DIGEST_LIMIT`
- `ANALYTICS_HEALTH_DIGEST_COOLDOWN_HOURS`
- `ANALYTICS_HEALTH_ALERT_COOLDOWN_MINUTES`
- `ANALYTICS_HEALTH_SLACK_WEBHOOK_URL`
- `ANALYTICS_HEALTH_LOGS_URL`
- `ANALYTICS_DATA_TRUST_LOOKBACK_DAYS`
- `ANALYTICS_DATA_TRUST_SILENCE_WINDOW_HOURS`
- `ANALYTICS_DATA_TRUST_MIN_CONVERSION_COUNT`
- `ANALYTICS_DATA_TRUST_ZERO_CONVERSION_CRITICAL_TRAFFIC`
- `ANALYTICS_DATA_TRUST_ATTRIBUTION_MINIMUM_PERCENT`
- `ANALYTICS_DATA_TRUST_GA4_TOLERANCE_PERCENT`
- `ANALYTICS_DATA_TRUST_TRAFFIC_DROP_THRESHOLD_PERCENT`
- `ANALYTICS_HEALTH_WAITING_WARNING_THRESHOLD`
- `ANALYTICS_HEALTH_WAITING_CRITICAL_THRESHOLD`
- `ANALYTICS_HEALTH_FAILED_CRITICAL_THRESHOLD`
- `ANALYTICS_HEALTH_MAX_SYNC_LAG_HOURS`
- `ANALYTICS_HEALTH_MIN_EVENT_ROWS_24H`
- `ANALYTICS_HEALTH_MAX_ATTRIBUTION_MISMATCH_PCT`
- `DEFAULT_ALLOWED_ORIGINS`
- `ALLOWED_ORIGINS`
- `NEXT_PUBLIC_SITE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `SESSION_TTL_HOURS`
- `CUSTOMER_PASSWORD_RESET_TTL_MS`
- `CUSTOMER_PASSWORD_RESET_WINDOW_MS`
- `CUSTOMER_PASSWORD_RESET_MAX_PER_IDENTIFIER`
- `CUSTOMER_PASSWORD_RESET_MAX_PER_IP`
- `CUSTOMER_PASSWORD_OTP_TTL_MS`
- `CUSTOMER_PASSWORD_OTP_MAX_ATTEMPTS`
- `CUSTOMER_PASSWORD_OTP_MAX_PER_PHONE`
- `CUSTOMER_PASSWORD_OTP_MAX_PER_IP`
- `CUSTOMER_PASSWORD_OTP_RESEND_COOLDOWN_MS`
- `CUSTOMER_REAUTH_TOKEN_TTL_MS`
- `RECAPTCHA_ENABLED`
- `RECAPTCHA_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `STOREFRONT_COOKIE_SECURE`
- `STOREFRONT_COOKIE_SAMESITE`
- `STOREFRONT_COOKIE_DOMAIN`
- `DEFAULT_USER_TEMP_PASSWORD`
- `STOREFRONT_GENERIC_CUSTOMER_PASSWORD`
- `SMS_PROVIDER`
- `TEXTBEE_API_KEY`
- `TEXTBEE_DEVICE_ID`
- `TEXTBEE_API_BASE_URL`
- `AUTH_OTP_LENGTH`
- `AUTH_OTP_TTL_MS`
- `AUTH_OTP_MAX_ATTEMPTS`
- `AUTH_PASSWORD_RESET_URL`
- `RUN_PRISMA_SEED_ON_BOOT`
- `ENABLE_DEMO_SEED`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_NAME`
- `DEFAULT_ADMIN_PASSWORD`
- `SEED_SUPERADMIN_EMAIL`
- `SEED_SUPERADMIN_PASSWORD`
- `SEED_SUPERADMIN_NAME`
- `SEED_SUPERADMIN_FIRST_NAME`
- `SEED_SUPERADMIN_LAST_NAME`
- `SEED_USER_PASSWORD`
- `PRISMA_APPLY_MIGRATIONS`
- `PRISMA_QUERY_TIMEOUT_MS`
- `PARAMETRIC_IMPORT_TIMEOUT_MS`
- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `EMAIL_PROVIDER`
- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_SECURE`
- `EMAIL_SMTP_USER`
- `EMAIL_SMTP_PASSWORD`
- `EMAIL_SMTP_ALLOW_INVALID_CERTS`
- `EMAIL_FROM_DEFAULT`
- `EMAIL_FROM_NAME_DEFAULT`
- `INBOX_EMAIL_IMAP_HOST`
- `INBOX_EMAIL_IMAP_PORT`
- `INBOX_EMAIL_IMAP_SECURITY`
- `INBOX_EMAIL_SMTP_HOST`
- `INBOX_EMAIL_SMTP_PORT`
- `INBOX_EMAIL_SMTP_SECURITY`
- `INBOX_EMAIL_USER`
- `INBOX_EMAIL_PASSWORD`
- `INBOX_EMAIL_DEFAULT_FROM`
- `INBOX_EMAIL_DEFAULT_NAME`
- `INBOX_EMAIL_DISPLAY_NAME`
- `INBOX_EMAIL_MAX_ATTACHMENT_MB`
- `INBOX_EMAIL_RATE_PER_MINUTE`
- `INBOX_EMAIL_POLL_INTERVAL_MS`
- `INBOX_EMAIL_POLL_BATCH_SIZE`
- `PAYMENTS_PROVIDER`
- `MP_PUBLIC_KEY`
- `MP_ACCESS_TOKEN`
- `MP_COUNTRY`
- `MP_INTEGRATOR_ID`
- `MP_APPLICATION_ID`
- `MP_TIMEOUT_MS`
- `CONFIG_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_ENABLED`
- `ADMIN_RECAPTCHA_ENABLED`
- `ADMIN_RECAPTCHA_SITE_KEY`
- `STOREFRONT_RECAPTCHA_ENABLED`
- `STOREFRONT_RECAPTCHA_SITE_KEY`

## Operational rules

- The public origin must change between `prod` and `testing`.
- The `frontend` admin must stay on `/admin` in both environments.
- The storefront must resolve API calls through `/api` and `/api/storefront`.
- Redis must stay internal and ephemeral in both environments.
- PostgreSQL stays external and is not part of the app stack.
- Production secrets and testing secrets must never be shared unless explicitly
  declared non-sensitive.
- If a new variable is added to any env file, update this contract in the same change.
