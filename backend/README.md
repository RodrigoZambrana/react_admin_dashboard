Backend API (NestJS + Fastify + Prisma)

Stack
- Node.js 20/22 + TypeScript
- NestJS (Fastify adapter)
- Prisma ORM
- PostgreSQL

Quick Start
- Copy `.env.example` to `.env` and adjust `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, and `RECAPTCHA_SECRET_KEY` as needed.
- Configure `STOREFRONT_GENERIC_CUSTOMER_PASSWORD` to the shared temporary password you want assigned to storefront customers that do not yet have credentials (defaults to `Storefront@2024` for local development).
- Install deps: `npm i`
- Generate Prisma client: `npm run prisma:generate`
- Create DB schema and run migrations: `npm run prisma:migrate`
- Seed base data: `npm run prisma:seed`
- Start dev server: `npm run start:dev`

Aplicar nuevas migraciones en un entorno existente
- Posicionate en la carpeta del backend: `cd backend`
- Instala (o actualiza) dependencias si todavía no están presentes: `npm install`
- Generá el cliente de Prisma para que los tipos reflejen los cambios: `npm run prisma:generate`
- Aplicá todas las migraciones pendientes contra la base configurada en `DATABASE_URL`: `npm run prisma:migrate`
- Si necesitás correrlo sin los scripts de npm (por ejemplo en una plataforma en la que sólo tenés acceso al binario), ejecutá `npx prisma migrate deploy`

Environment Configuration & Deployment Notes
- Cookie behaviour: `AuthController.buildAuthCookieOptions()` sets `secure: true` whenever `NODE_ENV !== 'development'`. In testing/production debes servir la API sobre HTTPS (idealmente desde el mismo origen que el frontend) para que el navegador acepte la cookie `access_token`. Para pruebas HTTP temporales fuera de dev, ejecutá el backend con `NODE_ENV=development` o ajustá ese helper para exponer un toggle.
- Required environment variables when `NODE_ENV` is not `development`:
  - `NODE_ENV=production` para habilitar defaults seguros.
  - `JWT_SECRET=<32+ random chars>` to sign JWTs.
  - `COOKIE_SECRET=<32+ random chars>` for Fastify cookie signing.
  - `ALLOWED_ORIGINS=https://your-frontend.example.com` (comma-separated list) so CORS allows the deployed frontend.
  - `PORT=4000` (or your platform-specific port) and asegúrate de publicarlo mediante tu plataforma/ingress (load balancer, App Platform, etc.).
- Frontend alignment:
  - In production, serve the built frontend from the same domain or configure Axios to hit the deployed API (e.g. expose `VITE_API_BASE=https://api.example.com` and use it in `BaseService`); the Vite proxy only applies during local development.
  - Set `VITE_STATE_SIGNATURE_KEY=<random secret>` so Redux Persist signatures remain environment-specific.
  - After sign-in, verify that requests keep `withCredentials: true` and that the `Authorization: Bearer <token>` header is present to avoid 401 responses.
  - The frontend loads reCAPTCHA Enterprise in every environment and requests a token for the `LOGIN` action before sign-in; provide `RECAPTCHA_SECRET_KEY` (backend) and `VITE_RECAPTCHA_SITE_KEY` (frontend) so validation succeeds.
- Parametric CSV imports:
  - The `/pricing/products/import-full` endpoint can run for several minutes when uploading large price matrices; tweak `PARAMETRIC_IMPORT_TIMEOUT_MS` (backend, default 120000ms) to raise or disable the server timeout.
  - Match the client-side timeout with `VITE_PARAMETRIC_IMPORT_TIMEOUT_MS` so Axios waits long enough before aborting the upload.
- Storefront Google OAuth:
  - Populate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` in every environment (dev redirect typically `http://localhost:4000/api/storefront/auth/google/callback`).
  - Optional cookie tuning: `STOREFRONT_COOKIE_SECURE`, `STOREFRONT_COOKIE_SAMESITE`, `STOREFRONT_COOKIE_DOMAIN`.
  - Run the new Prisma migration `20260615120000_storefront_google_oauth` and keep Prisma client regenerated.
  - Refer to `../docs/storefront-google-auth.md` for the complete Google Cloud Console walkthrough and testing checklist.
- Transactional email delivery:
  - All transactional emails are rendered through the email service (`src/email`) which pulls template definitions from the database. The admin UI at `/app/settings/email/config?tab=templates` allows editing and previewing every locale/variant pair.
  - Customers always receive messages in their preferred locale (`customer.preferredLocale`, defaulting to `es`). Administrators always receive Spanish copies so frontline staff see a consistent phrasing (for example, order confirmations use the `order.received_admin` event to display “Nuevo pedido recibido”).
  - Separate audiences exist for every event: customers and admins each have configurable notification channels (in-app + email). Admin recipients are resolved from role rules (`notification_settings` + `role_notification_rules`) and can be managed in the admin UI. Customers always receive the shopper-facing templates; staff only get the admin versions.
  - To enable delivery make sure the Email Settings section is configured: provider credentials (SMTP/API), default sender (`from` address/name), and optional reply-to or list-unsubscribe headers. Tests can be queued from the same screen, which calls `EmailService.sendTestEmail`.
  - Environment variables that influence email rendering:
    - `DEFAULT_EMAIL_LOCALE` (fallback locale when a template or recipient does not provide one).
    - `EMAIL_REPLY_TO` (optional override for the reply-to header).
    - `EMAIL_LIST_UNSUBSCRIBE` (optional header required by some providers).
    - `COMPANY_NAME` (used in template labels when the company profile is not populated).
  - Company footer data (trade name, support email/phone, website) is loaded from the company profile settings and cached for five minutes; keep those fields up to date to ensure the footer block renders correctly in both customer and admin copies.

Resetting the Database
- Ensure your `.env` is configured (especially `DATABASE_URL`) before touching Prisma commands.
- To fully wipe and repopulate the schema in one step, run `npx prisma migrate reset --force`.
- Alternatively, recreate tables with `npm run prisma:migrate` and then seed fresh data via `npm run prisma:seed`.

Troubleshooting Backend Availability
- If `curl http://localhost:4000/api/health` fails with `curl: (7) Failed to connect`, the container either never started or it crashed before binding port 4000.
- Even when `docker compose` shows the stack as “up”, the backend service may have exited early (e.g. due to an unhealthy database connection).
- Inspect the service status and recent logs to confirm what happened:
  - `docker compose -f deploy/docker-compose.dev.yml ps backend`
  - `docker compose -f deploy/docker-compose.dev.yml logs -n 100 backend`

HTTP
- Global prefix: `/api`
- Auth: Bearer JWT in `Authorization` header

Auth
- POST `/api/sign-in` { email, password, recaptchaToken? }
- POST `/api/sign-up` { name, lastName?, email, password }
- Passwords must be 8-128 chars and include at least one uppercase letter, one lowercase letter, one number, and one special character. The same policy applies to self-service and administrative resets.

Key Modules
- Users: `/api/users`
- Customers: `/api/customers/*`
- Sales (Products & Orders): `/api/sales/*`
- Settings: `/api/settings/*`
- Expenses: `/api/expenses/*`
- Account (stubs): `/api/account/*`
- Scrumboard (stubs): `/api/scrumboard/*`

Notes
- All entity IDs are numeric auto-incremented (Prisma `Int @id @default(autoincrement())`).
- Security: JWT auth, basic role structure, rate limiting, CORS, Helmet.
