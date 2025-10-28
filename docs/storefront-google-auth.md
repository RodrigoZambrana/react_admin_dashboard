# Storefront Google Authentication Setup

This guide explains how to enable Google Sign-In (OAuth 2.0 / OpenID Connect) for the Bonik storefront, covering local development, staging, and production deployments.

## Overview

- Authorization Code + PKCE flow handled entirely by the backend (`/api/storefront/auth/google/*`).
- The Next.js storefront opens a Google popup window, receives the result via `postMessage`, persists the session, and closes the modal.
- The backend validates the Google ID token with Google's JWKS, links/creates `Customer` records, issues storefront access/refresh JWTs, and sets `httpOnly` cookies (`storefront_access_token`, `storefront_refresh_token`).
- Minimal user data is stored in the new `CustomerOAuthAccount` table; Google access tokens are discarded after validation unless future scopes require them.

## 1. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Example (dev) | Notes |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | ✅ | `123456.apps.googleusercontent.com` | OAuth 2.0 client ID from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | ✅ | `super-secret-value` | Store securely; never commit. |
| `GOOGLE_OAUTH_REDIRECT_URI` | ✅ | `http://localhost:4000/api/storefront/auth/google/callback` | Must match the authorized redirect URI configured in Google Cloud. Use the HTTPS production URL in prod (e.g. `https://api.example.com/api/storefront/auth/google/callback`). |
| `STOREFRONT_COOKIE_SECURE` | Optional | `false` (dev), `true` (prod) | Force cookie `Secure` flag (`true` by default in production when unset). |
| `STOREFRONT_COOKIE_SAMESITE` | Optional | `lax` | Override SameSite policy (`lax`, `strict`, `none`). Default: `lax`. |
| `STOREFRONT_COOKIE_DOMAIN` | Optional | `.example.com` | Set if cookies must be shared across subdomains. |

Existing variables (`JWT_SECRET`, `COOKIE_SECRET`, `ALLOWED_ORIGINS`, `STOREFRONT_BASE_URL`) must remain configured as before.

### Frontend (`ecommerce/.env.local` or deployment vars)

| Variable | Required | Example (dev) | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_STOREFRONT_API_URL` | ✅ | `http://localhost:4000/api/storefront` | Already required for API calls. |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `http://localhost:3000` | Used to build absolute URLs and derive popup origins. |
| `NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED` | Optional | `true`/`false` | Feature flag. Defaults to `true` when unset. Set to `false` to hide the Google button without redeploying. |

## 2. Database Migration

New Prisma models:

- `CustomerOAuthAccount`: links Google accounts to `Customer` records.
- `StorefrontOAuthSession`: stores short-lived PKCE/state data for the authorization handshake.

Apply the migration and regenerate the Prisma client after pulling the changes:

```bash
cd backend
npm install                   # updates dependencies (adds `jose`)
npm run prisma:generate       # regenerate Prisma client
npm run prisma:migrate        # applies `20260615120000_storefront_google_oauth`
```

## 3. Google Cloud Console Configuration

1. **OAuth consent screen**
   - User type: *External* (unless you only allow internal workspace accounts).
   - App name, support email, and developer contact email required.
   - Scopes: add `openid`, `email`, `profile` (minimal set the app requests).
   - If the app is not yet verified, add testers under *Test Users* for non-production flows.

2. **OAuth credentials**
   - Navigate to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://your-frontend.example` (production)
   - Authorized redirect URIs:
     - `http://localhost:4000/api/storefront/auth/google/callback`
     - `https://api.example.com/api/storefront/auth/google/callback` (replace with your public API host)
   - Copy the Client ID and Secret, populate backend environment variables, and redeploy.

3. **Publish consent screen** when you are ready for production (Google may require verification for wide public access).

## 4. Application Behaviour

- **Start flow:** `POST /api/storefront/auth/google/start` (called by the Next.js app) issues a PKCE code challenge, persists it in `StorefrontOAuthSession`, and responds with the Google authorization URL.
- **Callback:** `GET /api/storefront/auth/google/callback` validates `state`, exchanges the authorization code, verifies the ID token signature/nonce, links or creates a `Customer`, and issues storefront tokens.
- **Session cookies:** `storefront_access_token` (15 min) and `storefront_refresh_token` (7 days) are `httpOnly`, `SameSite=Lax` by default, and `Secure` whenever `NODE_ENV !== 'development'` (or when `STOREFRONT_COOKIE_SECURE=true`).
- **Frontend handling:** The login modal listens for a `postMessage` payload (`type: "storefront:google-auth"`). On success it persists the session (local storage + cookies), closes the popup, and optionally navigates to the `returnPath` provided by the backend.
- **Logout:** `POST /api/storefront/auth/logout` clears both cookies; the frontend invokes it inside the session context and removes local storage.

## 5. Testing Checklist

- [ ] `npm run prisma:migrate` completes without errors; new tables exist.
- [ ] Backend `npm run test` passes (`src/storefront/oauth/__tests__/google-oauth.service.spec.ts` covers the callback flow).
- [ ] `POST /api/storefront/auth/google/start` returns a URL when required env vars are present; returns 503 when misconfigured.
- [ ] Completing Google sign-in in the storefront modal closes the popup, persists the session, and refreshes the header state.
- [ ] `storefront_access_token` and `storefront_refresh_token` cookies are httpOnly + secure (verify flags in production).
- [ ] `/api/storefront/account/*` requests succeed after Google login (the JWT cookie or local storage token authorises them).
- [ ] `/api/storefront/auth/logout` clears cookies (inspect browser storage) and the frontend session context resets.

## 6. Deployment Notes

- Use HTTPS for both the API and storefront in production; browsers block third-party cookies over HTTP.
- If the API sits behind a reverse proxy (NGINX, Cloudflare, etc.), ensure it forwards `X-Forwarded-Proto` so Fastify knows requests are HTTPS (important for cookie security).
- Configure CORS `ALLOWED_ORIGINS` to include the storefront origin. `cors` in `src/main.ts` already allows wildcard matches (`example.com` and subdomains) via `endsWith`.
- Rotate `GOOGLE_CLIENT_SECRET` periodically; update secrets in CI/CD accordingly.
- Monitor the `CustomerOAuthAccount.lastLoginAt` field (for auditing) and consider adding admin reporting later.

With these steps complete, Google authentication works for both local development and production, satisfying the acceptance criteria for the storefront login flow.
