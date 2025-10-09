Backend API (NestJS + Fastify + Prisma)

Stack
- Node.js 20/22 + TypeScript
- NestJS (Fastify adapter)
- Prisma ORM
- PostgreSQL

Quick Start
- Copy `.env.example` to `.env` and adjust `DATABASE_URL`, `JWT_SECRET`, and `ALLOWED_ORIGINS` as needed.
- Install deps: `npm i`
- Generate Prisma client: `npm run prisma:generate`
- Create DB schema and run migrations: `npm run prisma:migrate`
- Seed base data: `npm run prisma:seed`
- Start dev server: `npm run start:dev`

Environment Configuration & Deployment Notes
- Cookie behaviour: `AuthController.buildAuthCookieOptions()` sets `secure: true` whenever `NODE_ENV !== 'development'`. In staging/production you must serve the API over HTTPS (ideally from the same origin as the frontend) so the browser accepts the `access_token` cookie. For temporary HTTP testing outside dev, run the backend with `NODE_ENV=development` or adjust that helper to expose a toggle.
- Required environment variables when `NODE_ENV` is not `development`:
  - `NODE_ENV=production` (or `staging`) to enable secure defaults.
  - `JWT_SECRET=<32+ random chars>` to sign JWTs.
  - `COOKIE_SECRET=<32+ random chars>` for Fastify cookie signing.
  - `ALLOWED_ORIGINS=https://your-frontend.example.com` (comma-separated list) so CORS allows the deployed frontend.
  - `PORT=4000` (or your platform-specific port) and expose it through your reverse proxy.
- Frontend alignment:
  - In production, serve the built frontend from the same domain or configure Axios to hit the deployed API (e.g. expose `VITE_API_BASE=https://api.example.com` and use it in `BaseService`); the Vite proxy only applies during local development.
  - Set `VITE_STATE_SIGNATURE_KEY=<random secret>` so Redux Persist signatures remain environment-specific.
  - After sign-in, verify that requests keep `withCredentials: true` and that the `Authorization: Bearer <token>` header is present to avoid 401 responses.

Resetting the Database
- Ensure your `.env` is configured (especially `DATABASE_URL`) before touching Prisma commands.
- To fully wipe and repopulate the schema in one step, run `npx prisma migrate reset --force`.
- Alternatively, recreate tables with `npm run prisma:migrate` and then seed fresh data via `npm run prisma:seed`.

HTTP
- Global prefix: `/api`
- Auth: Bearer JWT in `Authorization` header

Auth
- POST `/api/sign-in` { email, password }
- POST `/api/sign-up` { name, email, password }
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
