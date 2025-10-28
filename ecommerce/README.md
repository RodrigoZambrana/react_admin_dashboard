# Ecommerce Integration Plan

This document outlines actionable steps required to replace the existing Wokiee-based storefront with the Bonik storefront template while preserving the backend-ready architecture developed so far.

## Phase 1 – Audit & Prepare

- Install dependencies and run `npm run dev` in `ecommerce` to review the template out of the box.
- Document the Bonik data model by inspecting `src/interfaces`, `src/models`, and any helper functions under `src/utils`.
- Note how the template manages contexts (cart, wishlist, etc.) and the global theme provider (styled-components with `themeOptions`).

Deliverable: short summary of key modules, routes, and theme dependencies.

### Phase 1 audit snapshot

- **Routing tree**: `src/app` ships with marketing `page.tsx` plus 15+ demo roots (`fashion-*`, `grocery-*`, `market-*`, etc.). Each route renders Bonik-specific section components under `src/page-sections`. These will need pruning into a single App Router namespace (e.g. `app/(storefront)`), keeping only the sections we bind to configurable layouts.
- **Mock data layer**: `src/utils/__api__` and `src/__server__` register extensive `axios-mock-adapter` endpoints that populate demo data from JSON-like modules in `src/__server__/__db__` and `src/data`. This entire layer must be replaced with our real REST client (`StorefrontApi`) while preserving response shapes expected by Bonik components.
- **State providers**: `src/contexts/CartContext.tsx` seeds cart state from `@data/cart` and handles quantity changes locally. We should retire this in favor of the persisted cart/auth flows now living in `src/state`.
- **Theming/SSR**: `src/app/layout.tsx` wraps the tree with `StyledComponentsRegistry`, `CartProvider`, and `ThemeProvider` from `src/theme`. Bonik relies on `styled-components` tokens defined in `themeOptions.ts`, `themeColors.ts`, and `themeShadows.ts`; these need to stay intact when we wire our storefront layout.
- **Types & models**: Domain models (products, shops, orders, etc.) reside in `src/models`, while `src/interfaces/index.ts` defines request helpers such as `SearchParams`/`SlugParams`. The current `SearchParams` is a `Promise`, explaining the “searchParams is a Promise” runtime error—we should adapt these types to the Next.js App Router pattern during migration.
- **Shared components**: Core UI primitives live in `src/components` (buttons, product cards, headers, navigation). We can reuse these shells but swap out demo-specific props once hooked into our backend responses.

### Legacy integration mapping

- **HTTP client & API bindings**: Replace Bonik's `src/lib/axios.ts` + mock endpoints with the `StorefrontApi`/`apiFetch` stack under `src/lib/api/storefront.ts` and `src/lib/http.ts`, which enforce HTTPS, timeouts, error typing (`ApiError`), and environment-driven base URLs.
- **Configuration & layouts**: `getStorefrontConfig`/`resolveHomeLayout` and the `DEFAULT_HOME_LAYOUTS` set now live in `src/lib/storefront-config.ts` and `src/lib/layouts/homeLayouts.ts`, preserving the 12 configurable home layouts used by the admin dashboard.
- **Global providers**: Swap Bonik's `CartContext` for the persisted cart provider in `src/state/cart-context.tsx`. Plan a similar bridge for session handling (reuse the login/register flows built under `src/app/(storefront)/account/*`).
- **App Router composition**: Mirror the existing `app/(storefront)` segmentation (home, products, cart, checkout, account, search). Bonik page sections can live under `src/app/storefront` while keeping server/client boundaries from the current implementation.
- **Utility helpers**: Reuse formatting helpers (e.g. `normalizeMoney`) and shared types from `src/lib/utils` and `src/types/storefront.ts` to avoid drift between UI variants and backend contracts.
- **Legacy Wokiee UI**: Treat `src/theme/**` and related contexts from the legacy theme as reference only; Bonik components should replace them while consuming the mapped data sources above.

## Phase 2 – Create Migration Scaffold

- Keep this project as the reference implementation (especially `src/lib/api/storefront.ts`, auth flows, and configuration modules).
- Inside `src`, create a dedicated namespace (`src/app/storefront` or similar) where migrated pages will be rewritten to use the Bonik structure but rely on our REST API client.
- Set up a shared `storefront-config` adapter that maps the existing layout configuration to Bonik page sections.

Deliverable: new layout scaffold using Bonik theme provider, plus an adapter module where configuration + API layers will live.

### Phase 2 progress snapshot

- App Router scaffold now lives under `src/app/(storefront)` with placeholder pages for home, products, product detail, categories, cart, checkout, account auth, and search.
- Storefront configuration context + persisted cart provider are wired through the new layout, ready for Bonik UI integration.
- Session management now lives in `src/state/session-context.tsx`, providing login/register/logout helpers backed by the real `StorefrontApi` and exposing state to all Bonik pages.
- Customer authentication now uses the backend `STOREFRONT_GENERIC_CUSTOMER_PASSWORD` (development default `Storefront@2024`) when legacy records lack credentials; new registrations clear the generic hash so the shared password is only used for staged accounts.
- `NEXT_PUBLIC_STOREFRONT_HOME_PATH` controls which layout is served at `/` (default `/`), and `/shop` now renders live catalog data for products and categories via the Storefront API with mock fallbacks.
- Legacy landing `page.tsx` now re-exports the storefront home route so the new tree owns `/`.
- Default API base points at `http://localhost:4000/api/storefront`, matching the existing backend route structure (override via `NEXT_PUBLIC_STOREFRONT_API_URL` / `STOREFRONT_API_URL` as needed).
- `/` now redirects to `/market-1`, preserving the Bonik demo entry point while we progressively swap mock endpoints for live data.

### Hybrid data strategy

- Market landing sections (`src/page-sections/market-1/**`) call into `src/utils/__api__/market-1.ts`, which now prefers `StorefrontApi` for product and category collections and falls back to the bundled mock adapter when live data is missing.
- Non-existent backend concepts (e.g. flash deal banners, brand spotlights) continue to rely on the template’s mock endpoints until equivalent REST resources are exposed.
- When binding additional sections, reuse the `fetchProductsWithFallback`/`fetchCategoriesWithFallback` helpers so we retain graceful degradation without losing backend parity.

## Phase 3 – Data Layer Alignment

- Replace mock data fetchers with calls to `StorefrontApi`. Create helper functions in `src/lib/storefront` that return Bonik-compatible data structures.
- Update contexts to use existing hooks (cart persistence, auth). Introduce bridge components if Bonik requires additional props.
- Ensure all HTTP calls enforce HTTPS in production and reuse error handling that already exists in the current app.

Deliverable: API bridge that lets Bonik components render real data without referencing the legacy mock data utilities.

## Phase 4 – Page Migration

Work page-by-page, moving each route into the Bonik layout while consuming the real data layer.

1. **Home** – Bind Bonik home sections to `StorefrontConfig.layouts`, keeping the 12 configurable structures.
2. **Shop/Product** – Replace static product pages with Bonik components, but load data from the backend (filters, pagination, related products).
3. **Auth** – Reuse the backend login/register/forgot-password endpoints, styling the forms with Bonik components.
4. **Cart/Checkout** – Wire the cart context to our persisted implementation and the checkout form to the order creation endpoint.
5. **Static pages** – Update contact/about/404 to match Bonik styling, keeping or adding REST hooks where content is dynamic.

Deliverable: all user-facing pages styled with Bonik, backed by the existing REST API layer.

## Phase 5 – Cleanup & Rollout

- Remove unused demo data and theme variants from Bonik template once replacements are live.
- Update documentation, `.env.example`, and deployment notes to reflect the new folder structure and configuration workflow.
- When the storefront tree is production-ready, archive any legacy UI remnants for reference.

Deliverable: final storefront ready for QA and deployment.

## Google Authentication Configuration

- The storefront login modal now supports Google OAuth via the backend endpoints under `/api/storefront/auth/google/*`.
- Backend env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, plus optional cookie flags (`STOREFRONT_COOKIE_*`). Update the backend `.env`, apply the migration `20260615120000_storefront_google_oauth`, and redeploy.
- Frontend env vars: `NEXT_PUBLIC_STOREFRONT_API_URL`, `NEXT_PUBLIC_SITE_URL`, and optional `NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED=false` to hide the button without code changes.
- The flow uses a popup + `postMessage`; success emits `{ type: "storefront:google-auth", status: "success" }`, allowing the session context to persist tokens and refresh UI state.
- For the full configuration and Google Cloud Console instructions, see `../docs/storefront-google-auth.md`.

---

Next Steps:

1. Run the audit (Phase 1) to map relevant Bonik modules.
2. Set up the adapter namespace and wire the Bonik theme provider into a new layout file (Phase 2).
3. Begin migrating the home page as the first real integration (Phase 4).

### Migration task backlog

| Area | Bonik sources to touch | Reference implementation | Action |
| --- | --- | --- | --- |
| Data fetching | `src/lib/axios.ts`, `src/utils/__api__/**`, `src/__server__/**` | `src/lib/api/storefront.ts`, `src/lib/http.ts` | Drop mock adapter, wire `StorefrontApi` wrapper and export helpers for Bonik sections. |
| Storefront config | `src/lib` (new folder), `src/app/layout.tsx` | `src/lib/storefront-config.ts`, `src/lib/layouts/homeLayouts.ts` | Port config loader + layout resolver and expose to Bonik pages. |
| Routing scaffold | `src/app/**` | `src/app/(storefront)/**` | Create `app/(storefront)` tree, move Bonik pages inside and align route defaults. |
| Cart/session | `src/contexts/CartContext.tsx`, `src/app/layout.tsx` | `src/state/cart-context.tsx`, `src/app/(storefront)/account/*` | Replace context with persisted cart + reuse auth flows. |
| Styling bridge | `src/theme/**`, `src/components/**` | Bonik theme (current folder) + `src/lib/utils/format.ts` | Keep styled-components registry, adapt component props to real API responses. |
| Cleanup | `src/data/**`, demo `src/app` routes | n/a | Remove once API-backed pages are live to shrink bundle. |
