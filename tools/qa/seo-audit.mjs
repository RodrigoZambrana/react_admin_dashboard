#!/usr/bin/env node

const baseUrl = process.env.SEO_AUDIT_BASE_URL ?? "http://127.0.0.1:8080";
const apiUrl = process.env.SEO_AUDIT_API_URL ?? `${baseUrl.replace(/\/$/, "")}/api/storefront`;
const expectedOrigin = new URL(baseUrl).origin;
const configuredNewProductSlugs = (process.env.SEO_AUDIT_NEW_PRODUCT_SLUGS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const resolverWarningMs = Number(process.env.SEO_AUDIT_MAX_RESOLVER_MS ?? 1000);
const htmlWarningMs = Number(process.env.SEO_AUDIT_MAX_HTML_MS ?? 1500);

const ROBOTS_REQUIRED_DISALLOWS = [
  "/account",
  "/checkout",
  "/payment",
  "/review",
  "/cart",
  "/auth",
  "/login",
  "/signup",
  "/search",
  "/products",
  "/product/search",
  "/api",
  "/vendor",
  "/shops",
];

const LISTING_PAGES = ["/", "/shop", "/tienda"];

const normalizeText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const decodeHtmlEntities = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
};

const dedupe = (values) => Array.from(new Set(values));

const normalizeRobotsValue = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/\s*,\s*/g, ",");

const time = async (fn) => {
  const startedAt = performance.now();
  const result = await fn();
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  return { result, durationMs };
};

const readJson = async (url) => {
  const { result } = await time(async () => {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    return response.json();
  });

  return result;
};

const fetchText = async (target, options = {}) => {
  const url = new URL(target, `${baseUrl}/`);
  const redirect = options.redirect ?? "follow";
  const headers = options.headers ?? {};
  const { result, durationMs } = await time(async () => {
    const response = await fetch(url, {
      redirect,
      headers,
    });
    const body = await response.text();
    return { response, body };
  });

  return {
    response: result.response,
    body: result.body,
    durationMs,
    requestedUrl: url.toString(),
  };
};

const parseJsonLd = (html) =>
  [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => normalizeText(match[1]))
    .flatMap((payload) => {
      if (!payload) {
        return [];
      }
      try {
        const parsed = JSON.parse(payload);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [{ __invalid: true, raw: payload }];
      }
    });

const extractMetaTagContent = (html, matcher) => {
  const doubleQuoted = html.match(matcher("double"));
  if (doubleQuoted?.[1]) {
    return doubleQuoted[1];
  }
  const singleQuoted = html.match(matcher("single"));
  return singleQuoted?.[1] ?? "";
};

const extractMetadata = (html) => {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description = extractMetaTagContent(
    html,
    (mode) =>
      mode === "double"
        ? /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i
        : /<meta[^>]*name='description'[^>]*content='([^']*)'[^>]*>/i,
  );
  const robots = extractMetaTagContent(
    html,
    (mode) =>
      mode === "double"
        ? /<meta[^>]*name="robots"[^>]*content="([^"]*)"[^>]*>/i
        : /<meta[^>]*name='robots'[^>]*content='([^']*)'[^>]*>/i,
  );
  const canonical = extractMetaTagContent(
    html,
    (mode) =>
      mode === "double"
        ? /<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*>/i
        : /<link[^>]*rel='canonical'[^>]*href='([^']*)'[^>]*>/i,
  );
  const body = normalizeText(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
  const links = dedupe(
    [...html.matchAll(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)]
      .map((match) => normalizeText(decodeHtmlEntities(match[1] ?? match[2] ?? "")))
      .filter(Boolean),
  );

  return {
    title: normalizeText(decodeHtmlEntities(title)),
    description: normalizeText(decodeHtmlEntities(description)),
    robots: normalizeText(decodeHtmlEntities(robots)),
    canonical: normalizeText(decodeHtmlEntities(canonical)),
    body,
    links,
    jsonLd: parseJsonLd(html),
  };
};

const findSchemaByType = (entries, type) =>
  entries.find((entry) => entry && !entry.__invalid && entry["@type"] === type) ?? null;

const validateOffers = (offers) => {
  if (!offers || typeof offers !== "object") {
    return false;
  }

  if (Array.isArray(offers)) {
    return offers.some((entry) => validateOffers(entry));
  }

  if (typeof offers.price === "number" || typeof offers.price === "string") {
    return Boolean(offers.priceCurrency) && Boolean(offers.availability);
  }

  if (typeof offers.lowPrice === "number" || typeof offers.lowPrice === "string") {
    return Boolean(offers.priceCurrency) && Boolean(offers.availability);
  }

  return false;
};

const buildMirrorPaths = (path) => {
  if (path.startsWith("/product/")) {
    const slug = path.replace("/product/", "");
    return [`/${slug}`, `/aberturas/${slug}`];
  }
  if (path.startsWith("/aberturas/")) {
    const slug = path.replace("/aberturas/", "");
    return [`/${slug}`, `/product/${slug}`];
  }
  if (/^\/[^/]+$/.test(path)) {
    const slug = path.slice(1);
    return [`/product/${slug}`, `/aberturas/${slug}`];
  }
  return [];
};

const normalizeLocationPath = (location) => {
  if (!location) {
    return "";
  }
  const parsed = new URL(location, `${baseUrl}/`);
  return `${parsed.pathname}${parsed.search}`;
};

const parseSitemap = (xml) =>
  [...xml.matchAll(/<url>\s*<loc>([\s\S]*?)<\/loc>(?:\s*<lastmod>([\s\S]*?)<\/lastmod>)?[\s\S]*?<\/url>/gi)].map(
    (match) => ({
      loc: normalizeText(decodeHtmlEntities(match[1])),
      lastmod: normalizeText(decodeHtmlEntities(match[2] ?? "")),
    }),
  );

const parseRobots = (content) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    lines,
    sitemaps: lines
      .filter((line) => /^sitemap:/i.test(line))
      .map((line) => normalizeText(line.replace(/^sitemap:\s*/i, ""))),
    disallow: lines
      .filter((line) => /^disallow:/i.test(line))
      .map((line) => normalizeText(line.replace(/^disallow:\s*/i, ""))),
  };
};

const buildAuditCases = async () => {
  const indexables = await readJson(`${apiUrl}/seo/indexables`);

  const productCases = indexables
    .filter((entry) => entry.entityType === "product")
    .slice(0, 3)
    .map((entry) => ({
      label: `product:${entry.slug}`,
      entityType: entry.entityType,
      path: entry.path,
      expectedSlug: entry.slug,
      updatedAt: entry.updatedAt,
      outOfBox: false,
    }));

  const canonicalCases = indexables
    .filter((entry) => entry.entityType === "canonical")
    .slice(0, 3)
    .map((entry) => ({
      label: `canonical:${entry.slug}`,
      entityType: entry.entityType,
      path: entry.path,
      expectedSlug: entry.slug,
      updatedAt: entry.updatedAt,
      outOfBox: false,
    }));

  const categoryCases = indexables
    .filter((entry) => entry.entityType === "category")
    .slice(0, 2)
    .map((entry) => ({
      label: `category:${entry.slug}`,
      entityType: entry.entityType,
      path: entry.path,
      expectedSlug: entry.slug,
      updatedAt: entry.updatedAt,
      outOfBox: false,
    }));

  const fallbackNewProductSlugs = indexables
    .filter((entry) => entry.entityType === "product")
    .slice(-2)
    .map((entry) => entry.slug);

  const newProductSlugs =
    configuredNewProductSlugs.length > 0 ? configuredNewProductSlugs : fallbackNewProductSlugs;

  const newProductCases = await Promise.all(
    newProductSlugs.map(async (slug) => {
      const product = await readJson(`${apiUrl}/products/${slug}`);
      return {
        label: `new-product:${slug}`,
        entityType: "product",
        path: product.routePath ?? `/product/${slug}`,
        expectedSlug: slug,
        updatedAt: product.updatedAt ?? null,
        outOfBox: true,
      };
    }),
  );

  return {
    indexables,
    cases: [...productCases, ...canonicalCases, ...categoryCases, ...newProductCases],
  };
};

const auditRedirects = async (entry, failures) => {
  const checks = [];
  const querySuffix = "?utm_source=seo-audit&variant=base";
  const expectedFinalPath = `${entry.path}${querySuffix}`;

  for (const mirrorPath of buildMirrorPaths(entry.path)) {
    const manual = await fetchText(`${mirrorPath}${querySuffix}`, {
      redirect: "manual",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const status = manual.response.status;
    const location = manual.response.headers.get("location") ?? "";
    const normalizedLocation = normalizeLocationPath(location);
    const queryPreserved = normalizedLocation === expectedFinalPath;
    const noLoop = normalizedLocation !== `${mirrorPath}${querySuffix}`;
    const ok = [301, 307, 308].includes(status) && queryPreserved && noLoop;

    if (!ok) {
      failures.push(
        `mirror redirect failed for ${mirrorPath}: status=${status} location=${normalizedLocation || location}`,
      );
    }

    const followed = await fetchText(`${mirrorPath}${querySuffix}`, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const finalUrl = new URL(followed.response.url);
    const followedOk = followed.response.status === 200 && `${finalUrl.pathname}${finalUrl.search}` === expectedFinalPath;
    if (!followedOk) {
      failures.push(`mirror redirect follow failed for ${mirrorPath}: final=${finalUrl.pathname}${finalUrl.search}`);
    }

    checks.push({
      path: mirrorPath,
      status,
      location: normalizedLocation || location,
      queryPreserved,
      noLoop,
      finalPath: `${finalUrl.pathname}${finalUrl.search}`,
      ok: ok && followedOk,
    });
  }

  return checks;
};

const validateOutOfBoxMetadata = (entry, resolver, failures, warnings) => {
  if (!entry.outOfBox) {
    return;
  }

  if (!normalizeText(resolver.title) || resolver.title === "Producto no disponible") {
    failures.push("out-of-the-box title generation failed");
  }

  if (!normalizeText(resolver.description) || resolver.description === "No pudimos resolver la ficha del producto solicitado.") {
    failures.push("out-of-the-box description generation failed");
  }

  if (normalizeText(resolver.description).length < 40) {
    warnings.push("out-of-the-box description is too short");
  }

  if (!normalizeText(resolver.canonicalUrl).startsWith(expectedOrigin)) {
    failures.push("out-of-the-box canonical is not absolute");
  }
};

const auditEntity = async (entry) => {
  const failures = [];
  const warnings = [];

  const resolverRequest = await time(async () =>
    readJson(`${apiUrl}/seo/resolve?path=${encodeURIComponent(entry.path)}`),
  );
  const resolver = resolverRequest.result;

  const htmlRequest = await fetchText(entry.path, {
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  const extracted = extractMetadata(htmlRequest.body);

  if (htmlRequest.response.status !== 200) {
    failures.push(`expected 200 for ${entry.path}, got ${htmlRequest.response.status}`);
  }

  if (!extracted.title) {
    failures.push("missing <title> in HTML source");
  }
  if (!extracted.description) {
    failures.push("missing meta description in HTML source");
  }
  if (!extracted.robots) {
    failures.push("missing robots meta in HTML source");
  }
  if (!extracted.canonical) {
    failures.push("missing canonical link in HTML source");
  }
  if (extracted.canonical.includes("?")) {
    failures.push("canonical contains query params");
  }
  if (!extracted.canonical.startsWith(expectedOrigin)) {
    failures.push(`canonical origin mismatch: ${extracted.canonical}`);
  }
  if (normalizeText(extracted.title) !== normalizeText(resolver.title)) {
    failures.push("title mismatch between HTML and resolver");
  }
  if (normalizeText(extracted.description) !== normalizeText(resolver.description)) {
    failures.push("description mismatch between HTML and resolver");
  }
  if (normalizeRobotsValue(extracted.robots) !== normalizeRobotsValue(resolver.robots)) {
    failures.push("robots mismatch between HTML and resolver");
  }
  if (normalizeText(extracted.canonical) !== normalizeText(resolver.canonicalUrl)) {
    failures.push(`canonical mismatch between HTML and resolver: ${resolver.canonicalUrl}`);
  }
  if (resolver.routePath !== entry.path) {
    failures.push(`routePath mismatch between resolver and selected case: ${resolver.routePath}`);
  }
  if (!extracted.body.toLowerCase().includes(normalizeText(resolver.title).toLowerCase())) {
    failures.push("SSR body does not include resolver title");
  }
  if (/loading\.\.\./i.test(extracted.body) && !extracted.body.toLowerCase().includes(normalizeText(resolver.title).toLowerCase())) {
    failures.push("HTML source still exposes loading fallback instead of indexable content");
  }

  if (resolverRequest.durationMs > resolverWarningMs) {
    warnings.push(`resolver latency high: ${resolverRequest.durationMs}ms`);
  }
  if (htmlRequest.durationMs > htmlWarningMs) {
    warnings.push(`SSR latency high: ${htmlRequest.durationMs}ms`);
  }

  const invalidJsonLd = extracted.jsonLd.filter((schema) => schema?.__invalid);
  if (invalidJsonLd.length > 0) {
    failures.push("invalid JSON-LD detected in HTML");
  }

  if (entry.entityType === "category") {
    const collectionSchema = findSchemaByType(extracted.jsonLd, "CollectionPage");
    if (!collectionSchema) {
      failures.push("missing CollectionPage JSON-LD");
    } else {
      if (normalizeText(collectionSchema.url) !== resolver.canonicalUrl) {
        failures.push("CollectionPage JSON-LD url mismatch");
      }
      if (!normalizeText(collectionSchema.name)) {
        failures.push("CollectionPage JSON-LD missing name");
      }
      if (!normalizeText(collectionSchema.description)) {
        failures.push("CollectionPage JSON-LD missing description");
      }
    }
  } else {
    const productSchema = findSchemaByType(extracted.jsonLd, "Product");
    if (!productSchema) {
      failures.push("missing Product JSON-LD");
    } else {
      if (!normalizeText(productSchema.name)) {
        failures.push("Product JSON-LD missing name");
      }
      if (!normalizeText(productSchema.description)) {
        failures.push("Product JSON-LD missing description");
      }
      if (normalizeText(productSchema.url) !== resolver.canonicalUrl) {
        failures.push("Product JSON-LD url mismatch");
      }
      if (!validateOffers(productSchema.offers)) {
        failures.push("Product JSON-LD offers missing valid price/availability");
      }
    }
  }

  validateOutOfBoxMetadata(entry, resolver, failures, warnings);
  const redirects = await auditRedirects(entry, failures);

  return {
    label: entry.label,
    path: entry.path,
    entityType: entry.entityType,
    outOfBox: entry.outOfBox,
    timings: {
      resolverMs: resolverRequest.durationMs,
      htmlMs: htmlRequest.durationMs,
    },
    resolver: {
      title: resolver.title,
      description: resolver.description,
      canonicalUrl: resolver.canonicalUrl,
      routePath: resolver.routePath,
      robots: resolver.robots,
      schemaType: resolver.schemaType,
    },
    html: {
      title: extracted.title,
      description: extracted.description,
      canonical: extracted.canonical,
      robots: extracted.robots,
      jsonLdTypes: extracted.jsonLd
        .filter((schema) => schema && !schema.__invalid)
        .map((schema) => schema["@type"])
        .filter(Boolean),
    },
    redirects,
    failures,
    warnings,
  };
};

const auditSitemap = async (indexables) => {
  const failures = [];
  const warnings = [];
  const response = await fetchText("/sitemap.xml", {
    redirect: "follow",
    headers: { Accept: "application/xml,text/xml" },
  });
  const entries = parseSitemap(response.body);
  const urls = entries.map((entry) => entry.loc);
  const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);

  if (response.response.status !== 200) {
    failures.push(`sitemap returned ${response.response.status}`);
  }
  if (entries.length === 0) {
    failures.push("sitemap has no url entries");
  }
  if (duplicates.length > 0) {
    failures.push(`sitemap contains duplicate URLs: ${dedupe(duplicates).join(", ")}`);
  }

  const sitemapSet = new Set(urls);
  for (const indexable of indexables) {
    const expectedUrl = new URL(indexable.path, `${baseUrl}/`).toString();
    if (!sitemapSet.has(expectedUrl)) {
      failures.push(`sitemap missing indexable URL: ${expectedUrl}`);
    }

    const item = entries.find((entry) => entry.loc === expectedUrl);
    if (!item?.lastmod) {
      failures.push(`sitemap missing lastmod for indexable URL: ${expectedUrl}`);
    }

    for (const mirrorPath of buildMirrorPaths(indexable.path)) {
      const mirrorUrl = new URL(mirrorPath, `${baseUrl}/`).toString();
      if (mirrorUrl !== expectedUrl && sitemapSet.has(mirrorUrl)) {
        failures.push(`sitemap includes duplicate mirror URL: ${mirrorUrl}`);
      }
    }
  }

  if (!urls.includes(new URL("/", `${baseUrl}/`).toString())) {
    warnings.push("sitemap does not include homepage");
  }

  return {
    status: response.response.status,
    entryCount: entries.length,
    sample: entries.slice(0, 10),
    failures,
    warnings,
  };
};

const auditRobots = async (sampleCases) => {
  const failures = [];
  const warnings = [];
  const response = await fetchText("/robots.txt", {
    redirect: "follow",
    headers: { Accept: "text/plain" },
  });
  const parsed = parseRobots(response.body);
  const expectedSitemap = new URL("/sitemap.xml", `${baseUrl}/`).toString();

  if (response.response.status !== 200) {
    failures.push(`robots.txt returned ${response.response.status}`);
  }
  if (!parsed.sitemaps.includes(expectedSitemap)) {
    failures.push(`robots.txt missing sitemap declaration: ${expectedSitemap}`);
  }

  for (const prefix of ROBOTS_REQUIRED_DISALLOWS) {
    if (!parsed.disallow.includes(prefix)) {
      failures.push(`robots.txt missing disallow prefix: ${prefix}`);
    }
  }

  for (const entry of sampleCases) {
    const blocked = parsed.disallow.some((prefix) => prefix !== "/" && entry.path.startsWith(prefix));
    if (blocked) {
      failures.push(`robots.txt blocks indexable path: ${entry.path}`);
    }
  }

  if (parsed.disallow.includes("/")) {
    warnings.push("robots.txt disallows the whole site");
  }

  return {
    status: response.response.status,
    sitemaps: parsed.sitemaps,
    disallow: parsed.disallow,
    failures,
    warnings,
  };
};

const auditInternalLinking = async (sampleCases) => {
  const failures = [];
  const warnings = [];
  const pages = dedupe([
    ...LISTING_PAGES,
    ...sampleCases.filter((entry) => entry.entityType === "category").map((entry) => entry.path),
  ]);
  const inspections = [];

  for (const pagePath of pages) {
    const response = await fetchText(pagePath, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const html = extractMetadata(response.body);
    const pageFailures = [];

    for (const entry of sampleCases) {
      for (const mirrorPath of buildMirrorPaths(entry.path)) {
        if (html.links.includes(mirrorPath)) {
          pageFailures.push(`links duplicate mirror path ${mirrorPath} instead of ${entry.path}`);
        }
      }
    }

    inspections.push({
      path: pagePath,
      status: response.response.status,
      linkCount: html.links.length,
      failures: pageFailures,
    });
    if (response.response.status !== 200) {
      failures.push(`${pagePath}: listing page returned ${response.response.status}`);
    }
    failures.push(...pageFailures.map((failure) => `${pagePath}: ${failure}`));

    if (html.links.length === 0) {
      warnings.push(`${pagePath}: page contains no internal links`);
    }
  }

  return { inspections, failures, warnings };
};

const auditContentQuality = (results) => {
  const failures = [];
  const warnings = [];

  const titleMap = new Map();
  const descriptionMap = new Map();

  for (const result of results) {
    const normalizedTitle = normalizeText(result.resolver.title).toLowerCase();
    const normalizedDescription = normalizeText(result.resolver.description).toLowerCase();

    if (!normalizedTitle || normalizedTitle === "producto no disponible") {
      failures.push(`${result.path}: invalid title content`);
    }
    if (!normalizedDescription || normalizedDescription === "no pudimos resolver la ficha del producto solicitado.") {
      failures.push(`${result.path}: invalid description content`);
    }
    if (normalizedDescription.length < 40) {
      warnings.push(`${result.path}: description shorter than 40 characters`);
    }

    if (titleMap.has(normalizedTitle)) {
      warnings.push(`${result.path}: duplicated title with ${titleMap.get(normalizedTitle)}`);
    } else {
      titleMap.set(normalizedTitle, result.path);
    }

    if (descriptionMap.has(normalizedDescription)) {
      warnings.push(`${result.path}: duplicated description with ${descriptionMap.get(normalizedDescription)}`);
    } else {
      descriptionMap.set(normalizedDescription, result.path);
    }
  }

  return { failures, warnings };
};

const buildPhaseSummary = (failures, warnings) => ({
  status: failures.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed",
  failures,
  warnings,
});

const main = async () => {
  const environmentFailures = [];
  const environmentWarnings = [];

  const rootResponse = await fetchText("/", {
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (rootResponse.response.status !== 200) {
    environmentFailures.push(`root returned ${rootResponse.response.status}`);
  }

  const { indexables, cases } = await buildAuditCases();
  const counts = {
    products: cases.filter((entry) => entry.entityType === "product" && !entry.outOfBox).length,
    canonicals: cases.filter((entry) => entry.entityType === "canonical").length,
    categories: cases.filter((entry) => entry.entityType === "category").length,
    outOfBoxProducts: cases.filter((entry) => entry.outOfBox).length,
  };

  if (counts.products < 3 || counts.canonicals < 3 || counts.categories < 2 || counts.outOfBoxProducts < 2) {
    environmentFailures.push(
      `insufficient audit coverage. products=${counts.products} canonicals=${counts.canonicals} categories=${counts.categories} outOfBox=${counts.outOfBoxProducts}`,
    );
  }

  const results = [];
  for (const entry of cases) {
    results.push(await auditEntity(entry));
  }

  const sitemap = await auditSitemap(indexables);
  const robots = await auditRobots(cases);
  const internalLinking = await auditInternalLinking(cases);
  const contentQuality = auditContentQuality(results);

  const routingFailures = results.flatMap((entry) =>
    entry.redirects.filter((redirect) => !redirect.ok).map((redirect) => `${entry.path}: redirect failed for ${redirect.path}`),
  );
  const routingWarnings = [];

  const ssrFailures = results.flatMap((entry) =>
    entry.failures
      .filter((failure) => /HTML|SSR body|loading fallback|missing <title>|missing meta description|missing robots meta/i.test(failure))
      .map((failure) => `${entry.path}: ${failure}`),
  );
  const ssrWarnings = [];

  const canonicalFailures = results.flatMap((entry) =>
    entry.failures
      .filter((failure) => /canonical|routePath/i.test(failure))
      .map((failure) => `${entry.path}: ${failure}`),
  );
  const canonicalWarnings = [];

  const jsonLdFailures = results.flatMap((entry) =>
    entry.failures
      .filter((failure) => /JSON-LD|Product JSON-LD|CollectionPage JSON-LD|offers/i.test(failure))
      .map((failure) => `${entry.path}: ${failure}`),
  );
  const jsonLdWarnings = [];

  const outOfBoxFailures = results.flatMap((entry) =>
    entry.outOfBox
      ? entry.failures
          .filter((failure) => /out-of-the-box|Producto no disponible|No pudimos resolver/i.test(failure))
          .map((failure) => `${entry.path}: ${failure}`)
      : [],
  );
  const outOfBoxWarnings = results.flatMap((entry) =>
    entry.outOfBox ? entry.warnings.map((warning) => `${entry.path}: ${warning}`) : [],
  );

  const performanceWarnings = results.flatMap((entry) =>
    entry.warnings
      .filter((warning) => /latency/i.test(warning))
      .map((warning) => `${entry.path}: ${warning}`),
  );
  const performanceFailures = [];

  const phases = {
    environment: buildPhaseSummary(environmentFailures, environmentWarnings),
    routing: buildPhaseSummary(routingFailures, routingWarnings),
    ssr: buildPhaseSummary(ssrFailures, ssrWarnings),
    canonical: buildPhaseSummary(canonicalFailures, canonicalWarnings),
    jsonLd: buildPhaseSummary(jsonLdFailures, jsonLdWarnings),
    outOfBox: buildPhaseSummary(outOfBoxFailures, outOfBoxWarnings),
    sitemap: buildPhaseSummary(sitemap.failures, sitemap.warnings),
    robots: buildPhaseSummary(robots.failures, robots.warnings),
    internalLinking: buildPhaseSummary(internalLinking.failures, internalLinking.warnings),
    performance: buildPhaseSummary(performanceFailures, performanceWarnings),
    contentQuality: buildPhaseSummary(contentQuality.failures, contentQuality.warnings),
  };

  const failures = Object.entries(phases).flatMap(([phase, summary]) =>
    summary.failures.map((failure) => ({ phase, failure })),
  );
  const warnings = Object.entries(phases).flatMap(([phase, summary]) =>
    summary.warnings.map((warning) => ({ phase, warning })),
  );

  console.log(
    JSON.stringify(
      {
        baseUrl,
        apiUrl,
        counts,
        testedUrls: cases.map((entry) => ({
          label: entry.label,
          path: entry.path,
          entityType: entry.entityType,
          outOfBox: entry.outOfBox,
        })),
        phases,
        details: {
          results,
          sitemap: {
            status: sitemap.status,
            entryCount: sitemap.entryCount,
            sample: sitemap.sample,
          },
          robots: {
            status: robots.status,
            sitemaps: robots.sitemaps,
            disallow: robots.disallow,
          },
          internalLinking: internalLinking.inspections,
        },
        failures,
        warnings,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
