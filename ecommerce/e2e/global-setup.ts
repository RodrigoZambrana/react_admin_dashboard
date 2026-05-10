import { spawnSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;
const DEFAULT_STOREFRONT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";
const storefrontHealthUrl = resolveHealthUrl(
  process.env.PLAYWRIGHT_STOREFRONT_HEALTH_URL,
  DEFAULT_STOREFRONT_BASE_URL
);
const backendHealthUrl = process.env.PLAYWRIGHT_BACKEND_HEALTH_URL
  ? process.env.PLAYWRIGHT_BACKEND_HEALTH_URL
  : process.env.PLAYWRIGHT_BACKEND_URL
    ? resolveHealthUrl(undefined, process.env.PLAYWRIGHT_BACKEND_URL)
    : null;

function resolveHealthUrl(override: string | undefined, baseUrl: string) {
  if (override) {
    return override;
  }

  return new URL("/api/health", baseUrl).toString();
}

async function waitForHealthcheck(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = spawnSync("curl", ["-fsS", url], {
      encoding: "utf8",
      timeout: 5_000
    });

    if (result.status === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for healthcheck: ${url}`);
}

export default async function globalSetup() {
  const checks = [waitForHealthcheck(storefrontHealthUrl, DEFAULT_TIMEOUT_MS)];
  if (backendHealthUrl) {
    checks.push(waitForHealthcheck(backendHealthUrl, DEFAULT_TIMEOUT_MS));
  }

  await Promise.all(checks);
}
