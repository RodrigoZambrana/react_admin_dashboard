import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  createManagedAdminUser,
  signInAdmin,
  startAdminInternalAssistantConversationForUser,
} from "./support/admin-api";
import { loginAsAdminUser, resolveAdminAppUrl } from "./support/admin-ui";
import { storefrontBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";

type ConversationDetail = {
  id: string;
  scope: string;
  messages: Array<{
    id: string;
    authorType: string;
    body: string | null;
    createdAt: string;
  }>;
  toolCalls: Array<{
    id: string;
    toolName: string;
    status: string;
    updatedAt: string;
  }>;
};

type SalesProductSearchResponse = {
  data: Array<{
    id: string;
    name: string;
    productCode: string | null;
    currency: string | null;
    salePrice: number | null;
    published: boolean;
  }>;
};

type ResponseContract = {
  label: string;
  mustContain?: Array<string | RegExp>;
  mustNotContain?: Array<string | RegExp>;
};

async function fetchConversationDetail(
  request: APIRequestContext,
  token: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const response = await request.get(
    `${backendBaseUrl}/api/conversations/${conversationId}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ConversationDetail;
}

async function waitForConversationState(
  request: APIRequestContext,
  token: string,
  conversationId: string,
  predicate: (detail: ConversationDetail) => boolean,
  timeoutMs = 35_000,
) {
  const started = Date.now();
  let lastDetail: ConversationDetail | null = null;

  while (Date.now() - started < timeoutMs) {
    lastDetail = await fetchConversationDetail(request, token, conversationId);
    if (predicate(lastDetail)) {
      return lastDetail;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `Conversation ${conversationId} did not reach the expected state. Last detail: ${JSON.stringify(
      lastDetail,
      null,
      2,
    )}`,
  );
}

function getLatestAgentReply(
  detail: ConversationDetail,
  startedAt: string,
): string {
  return (
    [...detail.messages]
      .reverse()
      .find(
        (message) =>
          message.authorType === "agent" &&
          message.createdAt >= startedAt &&
          typeof message.body === "string" &&
          message.body.length > 0,
      )?.body ?? ""
  );
}

function assertResponseContract(actual: string, contract: ResponseContract) {
  const missing = (contract.mustContain ?? []).filter((expected) =>
    typeof expected === "string" ? !actual.includes(expected) : !expected.test(actual),
  );
  const forbidden = (contract.mustNotContain ?? []).filter((unexpected) =>
    typeof unexpected === "string" ? actual.includes(unexpected) : unexpected.test(actual),
  );

  if (!missing.length && !forbidden.length) {
    return;
  }

  throw new Error(
    [
      `Response contract mismatch for ${contract.label}.`,
      missing.length
        ? `Missing: ${missing.map((entry) => entry.toString()).join(" | ")}`
        : null,
      forbidden.length
        ? `Forbidden present: ${forbidden
            .map((entry) => entry.toString())
            .join(" | ")}`
        : null,
      "Actual response:",
      actual,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function openInternalConversation(page: Page, conversationId: string) {
  await page.goto(resolveAdminAppUrl(`/app/crm/conversations/${conversationId}`), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible({
    timeout: 20_000,
  });
}

async function sendAdminChatMessage(page: Page, text: string) {
  await page.getByTestId("admin-conversation-reply-input").fill(text);
  await page.getByTestId("admin-conversation-reply-submit").click();
  await expect(page.getByTestId("admin-conversation-messages")).toContainText(text, {
    timeout: 20_000,
  });
}

async function prepareStorefrontChatPage(context: BrowserContext) {
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });
  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("storefront-webchat-launcher").evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("storefront-webchat-drawer")).toBeVisible();
  return page;
}

async function sendStorefrontWebchatMessage(page: Page, text: string) {
  await page.getByTestId("storefront-webchat-input").fill(text);
  await page.getByTestId("storefront-webchat-send").click();
  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(text, { timeout: 20_000 });
  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 30_000 });
}

async function getWebchatSession(page: Page) {
  const sessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(sessionRaw).toBeTruthy();
  return JSON.parse(sessionRaw as string) as {
    conversationId: string;
    scope: string;
  };
}

async function fetchSalesProducts(
  request: APIRequestContext,
  token: string,
  search: string,
): Promise<SalesProductSearchResponse> {
  const response = await request.post(`${backendBaseUrl}/api/sales/products`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    data: {
      pageIndex: 1,
      pageSize: 10,
      query: search,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as SalesProductSearchResponse;
}

async function publishSalesProduct(
  request: APIRequestContext,
  token: string,
  productId: number,
) {
  const response = await request.put(`${backendBaseUrl}/api/sales/products/update`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    data: {
      id: productId,
      published: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("persists an abertura through admin AI chat and reuses that product info in public and authenticated storefront chats", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(120_000);

  const uniqueId = Date.now();
  const widthMm = 1700 + (uniqueId % 173);
  const heightMm = 1400 + (uniqueId % 137);
  const formattedSize = `${widthMm} x ${heightMm}`;
  const sizeToken = `${widthMm}x${heightMm}`;
  const price = 234;
  const adminEmail = `ops.aberturas.${uniqueId}@example.com`;
  const adminPassword = `OpsAberturas@${uniqueId}`;
  const customer = buildTestCustomer(uniqueId);
  const adminPrompt = `Necesito agregar estas aberturas al sistema: Corrediza 2h2g serie probba blanco v4mm cierre fenix ${formattedSize} usd ${price}`;
  const customerPrompt = `Quiero precio e información para una corrediza 2h2g serie probba blanco v4mm cierre fenix de ${formattedSize}.`;

  const platformAdminToken = await signInAdmin(request);

  await createManagedAdminUser(request, {
    name: "QA",
    lastName: "Operations",
    email: adminEmail,
    password: adminPassword,
    role: "ADMIN",
    capabilityGroups: ["operations"],
  });

  const internalConversation = await startAdminInternalAssistantConversationForUser(
    request,
    { email: adminEmail, password: adminPassword },
    { tenantKey: "urucortinas" },
  );

  await loginAsAdminUser(page, { email: adminEmail, password: adminPassword });
  await openInternalConversation(page, internalConversation.id);

  const adminDraftStartedAt = new Date().toISOString();
  await sendAdminChatMessage(page, adminPrompt);

  const adminDraftDetail = await waitForConversationState(
    request,
    platformAdminToken,
    internalConversation.id,
    (detail) =>
      detail.messages.some(
        (message) =>
          message.authorType === "agent" &&
          message.createdAt >= adminDraftStartedAt &&
          typeof message.body === "string" &&
          message.body.length > 0,
      ) &&
      detail.toolCalls.some(
        (toolCall) =>
          toolCall.toolName === "prepare_aberturas_insert" &&
          toolCall.status.toLowerCase() === "executed" &&
          toolCall.updatedAt >= adminDraftStartedAt,
      ),
  );

  const adminDraftReply = getLatestAgentReply(adminDraftDetail, adminDraftStartedAt);
  assertResponseContract(adminDraftReply, {
    label: "admin operations draft reply",
    mustContain: [
      /He preparado la alta al sistema/i,
      /Listas para alta/i,
      new RegExp(sizeToken.replace("x", "\\s*x\\s*"), "i"),
      new RegExp(`USD\\s*${price}`, "i"),
      /¿Deseas agregar al sistema los ítems válidos\?/i,
    ],
    mustNotContain: [/vía operativa habitual/i],
  });

  const adminExecutionStartedAt = new Date().toISOString();
  await sendAdminChatMessage(page, "Sí, confirmo");

  const adminExecutionDetail = await waitForConversationState(
    request,
    platformAdminToken,
    internalConversation.id,
    (detail) =>
      detail.messages.some(
        (message) =>
          message.authorType === "agent" &&
          message.createdAt >= adminExecutionStartedAt &&
          typeof message.body === "string" &&
          message.body.length > 0,
      ) &&
      detail.toolCalls.some(
        (toolCall) =>
          toolCall.toolName === "create_product" &&
          toolCall.status.toLowerCase() === "executed" &&
          toolCall.updatedAt >= adminExecutionStartedAt,
      ),
  );

  const adminExecutionReply = getLatestAgentReply(
    adminExecutionDetail,
    adminExecutionStartedAt,
  );
  assertResponseContract(adminExecutionReply, {
    label: "admin operations execution reply",
    mustContain: [
      /Alta ejecutada correctamente/i,
      /\/app\/products\/edit\/\d+/i,
    ],
    mustNotContain: [/error desconocido/i],
  });

  const createdProductIdMatch = adminExecutionReply.match(/\/app\/products\/edit\/(\d+)/i);
  expect(createdProductIdMatch?.[1]).toBeTruthy();
  const createdProductId = Number(createdProductIdMatch?.[1]);

  const productsPayload = await fetchSalesProducts(
    request,
    platformAdminToken,
    sizeToken,
  );
  const persistedProduct = productsPayload.data.find(
    (item) => Number(item.id) === createdProductId,
  );
  expect(persistedProduct).toBeTruthy();
  expect(persistedProduct?.salePrice).toBe(price);
  expect(persistedProduct?.currency).toBe("USD");
  expect(persistedProduct?.published).toBe(false);
  expect(persistedProduct?.name ?? "").toContain("PROBBA");
  expect(persistedProduct?.name ?? "").toContain("BLANCO");
  expect(persistedProduct?.name ?? "").toContain(sizeToken);

  await publishSalesProduct(request, platformAdminToken, createdProductId);

  const publishedProductsPayload = await fetchSalesProducts(
    request,
    platformAdminToken,
    sizeToken,
  );
  const publishedProduct = publishedProductsPayload.data.find(
    (item) => Number(item.id) === createdProductId,
  );
  expect(publishedProduct?.published).toBe(true);

  let publicContext: BrowserContext | null = null;
  let authenticatedContext: BrowserContext | null = null;

  try {
    publicContext = await browser.newContext();
    const publicPage = await prepareStorefrontChatPage(publicContext);

    const publicStartedAt = new Date().toISOString();
    await sendStorefrontWebchatMessage(publicPage, customerPrompt);

    const publicSession = await getWebchatSession(publicPage);
    expect(publicSession.scope).toBe("customer_public");

    const publicDetail = await waitForConversationState(
      request,
      platformAdminToken,
      publicSession.conversationId,
      (detail) =>
        detail.scope === "customer_public" &&
        detail.messages.some(
          (message) =>
            message.authorType === "agent" &&
            message.createdAt >= publicStartedAt &&
            typeof message.body === "string" &&
            message.body.length > 0,
        ),
    );

    const publicReply = getLatestAgentReply(publicDetail, publicStartedAt);
    assertResponseContract(publicReply, {
      label: "storefront public reply",
      mustContain: [
        /probba/i,
        new RegExp(`\\b${price}\\b`, "i"),
        /precio|cotización|cotizacion|asesor/i,
      ],
      mustNotContain: [
        /alta al sistema/i,
        /payload/i,
        /insert/i,
        /\/app\/products\/edit\//i,
      ],
    });
    await expect(
      publicPage.locator('[data-testid="storefront-webchat-message-agent"]').last(),
    ).toContainText(String(price));

    authenticatedContext = await browser.newContext();
    const authenticatedPage = await authenticatedContext.newPage();
    await authenticatedPage.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });
    await registerCustomer(authenticatedPage.request, customer);
    await authenticatedPage.goto(storefrontBaseUrl, {
      waitUntil: "domcontentloaded",
    });
    await authenticatedPage.getByTestId("storefront-webchat-launcher").evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(
      authenticatedPage.getByTestId("storefront-webchat-drawer"),
    ).toBeVisible();

    const authenticatedStartedAt = new Date().toISOString();
    await sendStorefrontWebchatMessage(authenticatedPage, customerPrompt);

    const authenticatedSession = await getWebchatSession(authenticatedPage);
    expect(authenticatedSession.scope).toBe("customer_authenticated");

    const authenticatedDetail = await waitForConversationState(
      request,
      platformAdminToken,
      authenticatedSession.conversationId,
      (detail) =>
        detail.scope === "customer_authenticated" &&
        detail.messages.some(
          (message) =>
            message.authorType === "agent" &&
            message.createdAt >= authenticatedStartedAt &&
            typeof message.body === "string" &&
            message.body.length > 0,
        ),
    );

    const authenticatedReply = getLatestAgentReply(
      authenticatedDetail,
      authenticatedStartedAt,
    );
    assertResponseContract(authenticatedReply, {
      label: "storefront authenticated reply",
      mustContain: [
        /probba/i,
        new RegExp(`\\b${price}\\b`, "i"),
        /precio|cotización|cotizacion|asesor/i,
      ],
      mustNotContain: [
        /alta al sistema/i,
        /payload/i,
        /insert/i,
        /\/app\/products\/edit\//i,
      ],
    });
    await expect(
      authenticatedPage.locator('[data-testid="storefront-webchat-message-agent"]').last(),
    ).toContainText(String(price));
  } finally {
    await publicContext?.close();
    await authenticatedContext?.close();
  }
});
