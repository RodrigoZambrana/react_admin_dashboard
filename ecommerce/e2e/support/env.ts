export const storefrontBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const storefrontApiBaseUrl =
  process.env.PLAYWRIGHT_STOREFRONT_API_URL ?? "http://127.0.0.1:4000/api/storefront";
export const aiPlatformApiBaseUrl =
  process.env.PLAYWRIGHT_AI_PLATFORM_URL ?? "http://127.0.0.1:4110";
export const aiPlatformInternalToken =
  process.env.PLAYWRIGHT_AI_PLATFORM_INTERNAL_TOKEN ?? "local-ai-internal-token";
export const databaseUrl =
  process.env.PLAYWRIGHT_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/react_admin_dashboard?schema=public";
export const aiPlatformDatabaseUrl =
  process.env.PLAYWRIGHT_AI_PLATFORM_DATABASE_URL ??
  "postgresql://ai_platform:ai_platform@127.0.0.1:5434/ai_platform?schema=public";

export const inboxEmailAddress =
  process.env.PLAYWRIGHT_INBOX_EMAIL_ADDRESS ?? "desarrollo@software-strategy.com";
