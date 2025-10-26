# Storefront REST API

The `storefront` NestJS module exposes unauthenticated endpoints tailored to the public eCommerce frontend. Every route is prefixed with `/storefront` and respects the global rate limiter configured in `AppModule`.

> **Transport**: Always serve production traffic through HTTPS. Local development defaults to `http://localhost:4000`.

## Endpoints

### `GET /storefront/config`
Returns the runtime configuration consumed by the Next.js storefront:

- `defaultLayout`: active home layout key.
- `layouts`: 12 layout definitions. Missing entries fall back to `DEFAULT_HOME_LAYOUTS` on the frontend.
- `navigation`: primary/secondary/footer navigation links.
- `theme`, `seo`, `policies`, `announcement` metadata.

Override values by persisting JSON into `systemConfig` with key `storefront:config`.

### `GET /storefront/home-layouts/:key`
Fetches a single layout definition by key. Use this to preview a layout in the dashboard before persisting it.

### `GET /storefront/categories`
Lists product categories including an eager product count.

### `GET /storefront/products`
Paginated catalog listing.

Query params:

| Param | Description |
| --- | --- |
| `page` | 1-based page number (default 1). |
| `pageSize` | Items per page (default 12, max 48). |
| `category` | Category name/slug match (case insensitive). |
| `search` | Full-text search on name, description, or code. |
| `sort` | `newest`, `price-asc`, `price-desc`. |
| `tag` | Filter by product tag (Prisma string array). |

Response includes `{ data, total, page, pageSize, totalPages }` and emits currency-aware price objects.

### `GET /storefront/products/:identifier`
Returns a product detail payload. `:identifier` accepts the numeric id, product code, or the generated slug (`slug-id`). Includes gallery images and related products.

### `GET /storefront/products/:id/recommendations`
Top-N recommendations for the same category (default limit 8, optional `?limit=` query param).

### `POST /storefront/auth/register`
Creates or updates a `Customer` record with a hashed password.

Payload:

```json
{
  "email": "jane@example.com",
  "password": "<min 8 chars>",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

Returns `{ accessToken, refreshToken, expiresAt, customer }`. Tokens are scoped with `scope: "storefront"`.

### `POST /storefront/auth/login`
Validates credentials and issues a fresh token pair.

### `POST /storefront/auth/refresh`
Exchanges a refresh token for a new access token pair. Invalid or expired tokens raise `401`.

### `POST /storefront/orders`
Creates a lightweight order snapshot linked to the customer. Products must be published. The service normalises totals, tax, and line items.

```json
{
  "customer": { "email": "jane@example.com", "firstName": "Jane", "lastName": "Doe" },
  "shippingAddress": { "line1": "123 Main St", "city": "Montevideo", "zip": "11000", "country": "UY" },
  "items": [ { "productId": 1, "quantity": 2 } ],
  "notes": "Optional instructions"
}
```

Response returns order metadata along with computed totals to display a confirmation page.

## Authentication Tokens

- Access tokens: 15 minute TTL, `scope: "storefront"`, `tokenType: "access"`.
- Refresh tokens: 7 day TTL, `tokenType: "refresh"`.
- Admin JWT guard explicitly rejects tokens whose scope is not `admin`, preventing privilege escalation.

## Extending the Module

- Persist layout overrides by storing JSON in `systemConfig` and exposing edit forms via the dashboard.
- Integrate payment providers by augmenting `createOrder` to create payment intents and persisting gateway metadata.
- Introduce authenticated customer endpoints (order history, address book) by adding a dedicated guard that validates `scope === 'storefront'` access tokens.

