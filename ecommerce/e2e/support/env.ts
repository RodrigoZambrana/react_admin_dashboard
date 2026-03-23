export const storefrontBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const storefrontApiBaseUrl =
  process.env.PLAYWRIGHT_STOREFRONT_API_URL ?? "http://localhost:4000/api/storefront";
export const databaseUrl =
  process.env.PLAYWRIGHT_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/react_admin_dashboard?schema=public";
