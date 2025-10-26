# Ecommerce Storefront

A configurable eCommerce frontend built with Next.js 16 and Tailwind CSS. The storefront consumes the Node.js + Prisma backend via REST endpoints exposed under `/storefront` (HTTPS only in production) and keeps the 12 home layouts from the Wokiee template selectable through configuration.

## Prerequisites

- Node.js 20+
- Backend API running on `http://localhost:4000` (or a secure HTTPS endpoint in non-development environments)

## Environment Variables

Copy `.env.example` and adjust the values for your target environment:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_STOREFRONT_API_URL` | Public base URL for the backend storefront API (must be HTTPS outside local development). |
| `STOREFRONT_API_URL` | Server-side base URL for API calls. Defaults to the public value when omitted. |
| `NEXT_PUBLIC_SITE_URL` | Absolute URL of the storefront, used when generating SEO metadata. |

## Run Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to inspect the storefront. The app relies on the backend API at `http://localhost:4000/storefront`; start the backend in parallel (`npm run start:dev` inside `backend/`).

## Production Build

```bash
npm run build
npm start
```

To containerise the storefront add a Dockerfile similar to the admin frontend (multi-stage: builder ➜ minimal runtime) and pass the environment variables described above.

## Features

- **Dynamic layout registry**: 12 curated home layouts declared in `src/lib/layouts/homeLayouts.ts`. The backend may override them through `/storefront/config`; otherwise the frontend falls back to the defaults.
- **REST integrations**: catalog, categories, product details, cart estimation, and order creation communicate with the new `/storefront` endpoints implemented in the backend (`storefront` Nest module).
- **State management**: client-side cart stored in localStorage (`CartProvider`) with checkout summary and validation.
- **Authentication Stubs**: registration, login, and refresh flows exchange JWTs generated specifically for the storefront scope. UI forms wire into the backend but do not yet persist sessions in cookies.
- **Security-by-default**: server-side fetches validate HTTPS usage in production, JWTs use a dedicated `scope`, and no credentials are ever committed.

## Code Map

- `src/app/(storefront)` – Application routes (home, catalog, product page, cart, checkout, account). Each route remains server-first, streaming data from the backend when possible.
- `src/components` – Shared UI such as navigation, layout shell, product cards, cart UI, and forms.
- `src/lib/api` – Centralised REST client with typed helpers.
- `src/lib/storefront-config.ts` – Fetches runtime configuration, merges backend overrides with local defaults.
- `src/modules/home` – Renderers for all home page module types.
- `src/state/cart-context.tsx` – Cart state container with persistence and helper actions.

## Security Notes

- Always expose the storefront behind HTTPS. The frontend throws at build/runtime if `STOREFRONT_API_URL` uses plain HTTP in production mode to avoid mixed content and credential leakage.
- Storefront JWTs add `scope: 'storefront'` and a short 15 minute TTL. They are intentionally rejected by the admin `JwtAuthGuard` to prevent privilege escalation.
- Rate limiting and brute-force protection are handled server-side via the reused Nest throttler configuration.
- Never commit `.env.*` files; use the provided schema (`env.schema.json`) to keep deployments in sync.

## Backend Alignment

Ensure the backend is on the latest schema (`npm run prisma:migrate` inside `backend/`) and double-check the new module documentation in `docs/storefront.md` for endpoint details, required payloads, and response contracts.
