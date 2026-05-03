#!/usr/bin/env node

const BASE_URL = process.env.LOCAL_TEST_BASE_URL || "http://127.0.0.1:8080";
const TIMEOUT_MS = Number(process.env.LOCAL_TEST_SMOKE_TIMEOUT_MS || 120000);
const INITIAL_DELAY_MS = Number(process.env.LOCAL_TEST_SMOKE_INITIAL_DELAY_MS || 500);
const MAX_DELAY_MS = Number(process.env.LOCAL_TEST_SMOKE_MAX_DELAY_MS || 5000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTrailingSlash = (url) => (url.endsWith("/") ? url : `${url}/`);

async function fetchWithRetry(path, assertion, label) {
  const startedAt = Date.now();
  let attempt = 0;
  let delayMs = INITIAL_DELAY_MS;
  let lastError = null;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    attempt += 1;
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        redirect: "manual",
        headers: {
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });
      const body = await response.text();
      assertion(response, body);
      console.log(`[smoke] ${label} ok (${response.status})`);
      return;
    } catch (error) {
      lastError = error;
      const remaining = TIMEOUT_MS - (Date.now() - startedAt);
      if (remaining <= 0) {
        break;
      }
      const waitMs = Math.min(delayMs, remaining);
      console.log(`[smoke] ${label} retry ${attempt} in ${waitMs}ms`);
      await sleep(waitMs);
      delayMs = Math.min(delayMs * 1.5, MAX_DELAY_MS);
    }
  }

  throw new Error(`[smoke] ${label} failed after ${attempt} attempts: ${lastError?.message ?? "unknown error"}`);
}

const assertHtml = (response, body, expectedStatus = 200) => {
  if (response.status !== expectedStatus) {
    throw new Error(`expected HTTP ${expectedStatus}, got ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(`expected text/html content-type, got "${contentType}"`);
  }
  if (!/<html[\s>]/i.test(body)) {
    throw new Error("expected HTML payload");
  }
};

const assertJsonOk = (response, body) => {
  if (response.status !== 200) {
    throw new Error(`expected HTTP 200, got ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`expected application/json content-type, got "${contentType}"`);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error("expected JSON payload");
  }

  if (!parsed || parsed.status !== "ok") {
    throw new Error(`expected JSON { status: "ok" }, got ${body}`);
  }
};

async function main() {
  console.log(`[smoke] base=${BASE_URL}`);

  await fetchWithRetry("/api/health", assertJsonOk, "/api/health");
  await fetchWithRetry("/", (response, body) => assertHtml(response, body, 200), "/");
  await fetchWithRetry("/admin", (response, body) => assertHtml(response, body, 200), "/admin");

  const response = await fetch(`${withTrailingSlash(BASE_URL)}`);
  if (!response.ok) {
    throw new Error(`[smoke] base url returned ${response.status}`);
  }

  console.log("[smoke] all checks passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
