import { spawnSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;

const storefrontHealthUrl =
  process.env.PLAYWRIGHT_STOREFRONT_HEALTH_URL ?? "http://127.0.0.1:3000/api/health";
const backendHealthUrl =
  process.env.PLAYWRIGHT_BACKEND_HEALTH_URL ?? "http://127.0.0.1:4000/api/health";

async function waitForHealthcheck(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = spawnSync("curl", ["-fsS", url], {
      encoding: "utf8"
    });

    if (result.status === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for healthcheck: ${url}`);
}

export default async function globalSetup() {
  await Promise.all([
    waitForHealthcheck(storefrontHealthUrl, DEFAULT_TIMEOUT_MS),
    waitForHealthcheck(backendHealthUrl, DEFAULT_TIMEOUT_MS)
  ]);
}
