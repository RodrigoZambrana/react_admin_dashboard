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

Resetting the Database
- Ensure your `.env` is configured (especially `DATABASE_URL`) before touching Prisma commands.
- To fully wipe and repopulate the schema in one step, run `npx prisma migrate reset --force`.
- Alternatively, recreate tables with `npm run prisma:migrate` and then seed fresh data via `npm run prisma:seed`.

HTTP
- Global prefix: `/api`
- Auth: Bearer JWT in `Authorization` header

Auth
- POST `/api/sign-in` { userName, password }
- POST `/api/sign-up` { userName, name, email, password }

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

