import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { signInAdmin } from "./support/admin-api";
import { resolveAdminAppUrl, loginAsAdmin } from "./support/admin-ui";
import { storefrontApiBaseUrl, storefrontBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";

type ConversationDetail = {
  id: string;
  scope: string;
  aiState?: {
    memory?: {
      intentKey?: string | null;
      taskSummary?: string | null;
      lastResetAt?: string | null;
      resetCount?: number | null;
      historyTurnCount?: number | null;
    } | null;
  } | null;
  messages: Array<{
    id: string;
    authorType: string;
    body: string | null;
    createdAt: string;
  }>;
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
  timeoutMs = 30_000,
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

async function sendStorefrontWebchatMessage(
  page: Page,
  text: string,
  options?: { expectAgentReply?: boolean },
) {
  await page.getByTestId("storefront-webchat-input").fill(text);
  await page.getByTestId("storefront-webchat-send").click();
  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(text, { timeout: 20_000 });
  if (options?.expectAgentReply !== false) {
    await expect(
      page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
    ).toBeVisible({ timeout: 30_000 });
  }
}

async function ensureStorefrontChatOpen(page: Page) {
  const drawer = page.getByTestId("storefront-webchat-drawer");
  const launcher = page.getByTestId("storefront-webchat-launcher");

  if (await drawer.isVisible().catch(() => false)) {
    return;
  }

  await expect(launcher).toBeVisible({ timeout: 15_000 });
  await launcher.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(drawer).toBeVisible();
}

async function registerAuthenticatedCustomer(
  page: Page,
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  },
) {
  const registerResponse = await page.request.post(
    `${storefrontApiBaseUrl}/auth/register`,
    {
      data: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        password: customer.password,
        locale: "es",
      },
    },
  );
  expect(registerResponse.ok()).toBeTruthy();
}

test("authenticated webchat keeps continuity for related follow-up and exposes task reset in admin after topic shift", async ({
  page,
  request,
}) => {
  const adminToken = await signInAdmin(request);
  const customer = buildTestCustomer();

  await registerAuthenticatedCustomer(page, customer);

  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });

  await ensureStorefrontChatOpen(page);

  const firstPrompt =
    "Quiero cotización para una corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120.";
  const secondPrompt = "¿Ese mismo modelo puede venir en negro?";
  const thirdPrompt =
    "Ahora necesito cambiar mi dirección de entrega y actualizar mis datos de cuenta.";

  await sendStorefrontWebchatMessage(page, firstPrompt);

  const sessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(sessionRaw).toBeTruthy();

  const session = JSON.parse(sessionRaw as string) as {
    conversationId: string;
    scope: string;
  };

  expect(session.conversationId).toBeTruthy();
  expect(session.scope).toBe("customer_authenticated");

  const firstState = await waitForConversationState(
    request,
    adminToken,
    session.conversationId,
    (detail) =>
      detail.scope === "customer_authenticated" &&
      Boolean(detail.aiState?.memory?.intentKey) &&
      detail.messages.some(
        (message) =>
          message.authorType === "agent" &&
          typeof message.body === "string" &&
          message.body.length > 0,
      ),
  );

  const initialIntentKey = firstState.aiState?.memory?.intentKey ?? null;
  expect(initialIntentKey).toBeTruthy();
  expect(firstState.aiState?.memory?.lastResetAt ?? null).toBeNull();

  await sendStorefrontWebchatMessage(page, secondPrompt);

  const secondState = await waitForConversationState(
    request,
    adminToken,
    session.conversationId,
    (detail) =>
      detail.messages.filter((message) => message.authorType === "customer").length >=
      2,
  );

  expect(secondState.scope).toBe("customer_authenticated");
  expect(secondState.aiState?.memory?.intentKey ?? null).toBe(initialIntentKey);
  expect(secondState.aiState?.memory?.lastResetAt ?? null).toBeNull();

  await sendStorefrontWebchatMessage(page, thirdPrompt);

  const resetState = await waitForConversationState(
    request,
    adminToken,
    session.conversationId,
    (detail) =>
      detail.scope === "customer_authenticated" &&
      Boolean(detail.aiState?.memory?.lastResetAt) &&
      (detail.aiState?.memory?.resetCount ?? 0) >= 1,
  );

  expect(resetState.aiState?.memory?.intentKey).toBeTruthy();
  expect(resetState.aiState?.memory?.taskSummary).toBeTruthy();
  expect(resetState.aiState?.memory?.lastResetAt).toBeTruthy();
  expect(resetState.aiState?.memory?.resetCount).toBeGreaterThanOrEqual(1);

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-conversations-page")).toBeVisible({
    timeout: 20_000,
  });
  await page
    .getByTestId("admin-conversations-search-input")
    .fill(`${customer.firstName} ${customer.lastName}`);

  const conversationRow = page.getByTestId(
    `admin-conversation-${session.conversationId}`,
  );
  await expect(conversationRow).toBeVisible({ timeout: 20_000 });
  await expect(conversationRow).toContainText("Reset de tarea");
  await expect(
    page.getByTestId(`admin-conversation-task-summary-${session.conversationId}`),
  ).toContainText("cambiar mi dirección de entrega", {
    timeout: 20_000,
  });
  await conversationRow.click();

  await expect(page).toHaveURL(
    new RegExp(`/app/crm/conversations/${session.conversationId}$`),
  );
  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible();
  await page.getByTestId("admin-conversation-details-open").click();
  await expect(page.getByText(/^Reset de tarea:/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/^Tarea:/i)).toBeVisible();
  await expect(page.getByTestId("admin-conversation-task-summary-inline")).toContainText(
    "cambiar mi dirección de entrega",
  );
  await page.getByTestId("admin-conversation-task-summary-apply").click();
  await expect(page.getByTestId("admin-conversation-handoff-notes")).toHaveValue(
    /cambiar mi dirección de entrega/i,
  );
});

test("authenticated webchat persists transcript across reload and keeps task summary visible in admin", async ({
  page,
  request,
}) => {
  const adminToken = await signInAdmin(request);
  const customer = buildTestCustomer();

  await registerAuthenticatedCustomer(page, customer);

  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });

  await ensureStorefrontChatOpen(page);

  const prompt =
    "Quiero cotización para una corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120.";
  await sendStorefrontWebchatMessage(page, prompt, { expectAgentReply: false });

  const beforeReloadSessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(beforeReloadSessionRaw).toBeTruthy();
  const beforeReloadSession = JSON.parse(beforeReloadSessionRaw as string) as {
    conversationId: string;
    scope: string;
  };
  expect(beforeReloadSession.scope).toBe("customer_authenticated");

  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureStorefrontChatOpen(page);
  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(prompt, {
    timeout: 20_000,
  });

  const afterReloadSessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(afterReloadSessionRaw).toBeTruthy();
  const afterReloadSession = JSON.parse(afterReloadSessionRaw as string) as {
    conversationId: string;
    scope: string;
  };
  expect(afterReloadSession.conversationId).toBe(beforeReloadSession.conversationId);
  expect(afterReloadSession.scope).toBe("customer_authenticated");

  const detail = await waitForConversationState(
    request,
    adminToken,
    afterReloadSession.conversationId,
    (conversation) =>
      conversation.scope === "customer_authenticated" &&
      Boolean(conversation.aiState?.memory?.taskSummary),
  );

  expect(detail.aiState?.memory?.taskSummary ?? "").toContain("corrediza");

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await page
    .getByTestId("admin-conversations-search-input")
    .fill(`${customer.firstName} ${customer.lastName}`);

  const conversationRow = page.getByTestId(
    `admin-conversation-${afterReloadSession.conversationId}`,
  );
  await expect(conversationRow).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByTestId(
      `admin-conversation-task-summary-${afterReloadSession.conversationId}`,
    ),
  ).toContainText("corrediza");
});
