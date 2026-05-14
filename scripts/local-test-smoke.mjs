#!/usr/bin/env node

const BASE_URL = process.env.LOCAL_TEST_BASE_URL || "http://127.0.0.1:8080";
const TIMEOUT_MS = Number(process.env.LOCAL_TEST_SMOKE_TIMEOUT_MS || 120000);
const INITIAL_DELAY_MS = Number(process.env.LOCAL_TEST_SMOKE_INITIAL_DELAY_MS || 500);
const MAX_DELAY_MS = Number(process.env.LOCAL_TEST_SMOKE_MAX_DELAY_MS || 5000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTrailingSlash = (url) => (url.endsWith("/") ? url : `${url}/`);

async function fetchWithRetry(path, assertion, label, headers = {}) {
  const startedAt = Date.now();
  let attempt = 0;
  let delayMs = INITIAL_DELAY_MS;
  let lastError = null;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    attempt += 1;
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        redirect: "manual",
        headers,
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

const assertAdminHtml = (response, body, expectedStatus = 200) => {
  assertHtml(response, body, expectedStatus);
  const robotsHeader = response.headers.get("x-robots-tag") || "";
  if (!robotsHeader.toLowerCase().includes("noindex")) {
    throw new Error(`expected X-Robots-Tag header with noindex, got "${robotsHeader}"`);
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

const assertJavascriptBundle = (response, body) => {
  if (response.status !== 200) {
    throw new Error(`expected HTTP 200, got ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("javascript")) {
    throw new Error(`expected JavaScript content-type, got "${contentType}"`);
  }

  const trimmed = body.trimStart();
  if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
    throw new Error("expected JavaScript payload, got HTML");
  }
};

async function main() {
  console.log(`[smoke] base=${BASE_URL}`);

  const htmlHeaders = {
    Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  };
  const assetHeaders = {
    Accept: "*/*",
  };

  await fetchWithRetry("/api/health", assertJsonOk, "/api/health", {
    Accept: "application/json",
  });
  await fetchWithRetry("/", (response, body) => assertHtml(response, body, 200), "/", htmlHeaders);
  await fetchWithRetry("/admin", (response, body) => assertAdminHtml(response, body, 200), "/admin", htmlHeaders);
  await fetchWithRetry(
    "/admin/sign-in",
    (response, body) => assertAdminHtml(response, body, 200),
    "/admin/sign-in",
    htmlHeaders,
  );
  await fetchWithRetry(
    "/admin/sales/dashboard",
    (response, body) => assertAdminHtml(response, body, 200),
    "/admin/sales/dashboard",
    htmlHeaders,
  );
  await fetchWithRetry(
    "/admin/img/logo/logo-dark-full.png",
    (response, body) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, got ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("image/")) {
        throw new Error(`expected image content-type, got "${contentType}"`);
      }
      if (body.length === 0) {
        throw new Error("expected image payload");
      }
    },
    "admin logo asset",
    assetHeaders,
  );
  await fetchWithRetry(
    "/admin/img/others/auth-side-bg.jpg",
    (response, body) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, got ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("image/")) {
        throw new Error(`expected image content-type, got "${contentType}"`);
      }
      if (body.length === 0) {
        throw new Error("expected image payload");
      }
    },
    "admin auth side bg",
    assetHeaders,
  );
  await fetchWithRetry(
    "/admin/img/others/auth-cover-bg.jpg",
    (response, body) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, got ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("image/")) {
        throw new Error(`expected image content-type, got "${contentType}"`);
      }
      if (body.length === 0) {
        throw new Error("expected image payload");
      }
    },
    "admin auth cover bg",
    assetHeaders,
  );

  const homepage = await fetch(`${withTrailingSlash(BASE_URL)}`, {
    redirect: "manual",
    headers: {
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    },
  });
  const html = await homepage.text();
  const chunkMatch = html.match(/\/_next\/static\/chunks\/[^"'\\s>]+\.js/g);
  if (!chunkMatch || chunkMatch.length === 0) {
    throw new Error("[smoke] could not find any Next chunk URLs in homepage HTML");
  }

  const uniqueChunks = [...new Set(chunkMatch)].slice(0, 3);
  for (const chunkPath of uniqueChunks) {
    await fetchWithRetry(chunkPath, assertJavascriptBundle, `chunk ${chunkPath}`, assetHeaders);
  }

  const adminHtmlResponse = await fetch(`${withTrailingSlash(BASE_URL)}admin/sales/dashboard`, {
    headers: htmlHeaders,
  });
  const adminHtml = await adminHtmlResponse.text();
  const adminAssetMatch = adminHtml.match(/\/admin\/assets\/[^"'\\s>]+(?:\.js|\.css)/g);
  if (!adminAssetMatch || adminAssetMatch.length === 0) {
    throw new Error("[smoke] could not find admin asset URLs in /admin HTML");
  }

  const uniqueAdminAssets = [...new Set(adminAssetMatch)].slice(0, 2);
  for (const assetPath of uniqueAdminAssets) {
    await fetchWithRetry(
      assetPath,
      assetPath.endsWith(".css")
        ? (response, body) => {
            if (response.status !== 200) {
              throw new Error(`expected HTTP 200, got ${response.status}`);
            }
            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("text/css")) {
              throw new Error(`expected CSS content-type, got "${contentType}"`);
            }
            if (!body.includes("{")) {
              throw new Error("expected CSS payload");
            }
          }
        : assertJavascriptBundle,
      `admin asset ${assetPath}`,
      assetHeaders,
    );
  }

  await fetchWithRetry(
    "/_next/image?url=%2Fmedia%2Fstories%2Fproyectos%2Fpaneles-7.jpeg&w=640&q=75",
    (response, body) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, got ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("image/")) {
        throw new Error(`expected image content-type, got "${contentType}"`);
      }
      if (body.length === 0) {
        throw new Error("expected image payload");
      }
    },
    "home paneles image",
    assetHeaders,
  );

  await fetchWithRetry(
    "/_next/image?url=http%3A%2F%2Flocalhost%3A8080%2Fmedia%2Fproducts%2Fbandas-verticales%2Fimages%2Fbandas_6.jpeg&w=640&q=75",
    (response) => {
      if (response.status !== 307) {
        throw new Error(`expected HTTP 307, got ${response.status}`);
      }
      const location = response.headers.get("location") || "";
      if (!location.includes("/_next/image?url=%2Fmedia%2Fproducts%2Fbandas-verticales%2Fimages%2Fbandas_6.jpeg")) {
        throw new Error(`expected canonicalized location, got "${location}"`);
      }
    },
    "legacy absolute image redirect",
    assetHeaders,
  );

  const response = await fetch(`${withTrailingSlash(BASE_URL)}`, {
    headers: htmlHeaders,
  });
  if (!response.ok) {
    throw new Error(`[smoke] base url returned ${response.status}`);
  }

  console.log("[smoke] all checks passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
