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
- Storefront Google OAuth:
  - Populate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` in every environment (dev redirect typically `http://localhost:4000/api/storefront/auth/google/callback`).
  - Optional cookie tuning: `STOREFRONT_COOKIE_SECURE`, `STOREFRONT_COOKIE_SAMESITE`, `STOREFRONT_COOKIE_DOMAIN`.
  - Run the new Prisma migration `20260615120000_storefront_google_oauth` and keep Prisma client regenerated.
  - Refer to `../docs/storefront-google-auth.md` for the complete Google Cloud Console walkthrough and testing checklist.

Resetting the Database
- Ensure your `.env` is configured (especially `DATABASE_URL`) before touching Prisma commands.
- To fully wipe and repopulate the schema in one step, run `npx prisma migrate reset --force`.
- Alternatively, recreate tables with `npm run prisma:migrate` and then seed fresh data via `npm run prisma:seed`.

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
