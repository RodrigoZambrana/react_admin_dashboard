import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { signInAdmin } from "./support/admin-api";
import { aiPlatformApiBaseUrl, storefrontApiBaseUrl, storefrontBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";

type ConversationDetail = {
  id: string;
  scope: string;
  aiState?: {
    memory?: {
      intentKey?: string | null;
      state?: string | null;
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
    `${aiPlatformApiBaseUrl}/admin/conversations/${conversationId}`,
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

async function registerCustomer(
  request: APIRequestContext,
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  },
) {
  const registerResponse = await request.post(
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

test("public webchat persists quote transcript across reload and keeps it visible in admin", async ({
  page,
  request,
}) => {
  const adminToken = await signInAdmin(request);
  const customer = buildTestCustomer();

  await registerCustomer(request, customer);

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
  expect(beforeReloadSession.scope).toBe("customer_public");

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
  expect(afterReloadSession.scope).toBe("customer_public");

  const detail = await waitForConversationState(
    request,
    adminToken,
    afterReloadSession.conversationId,
    (conversation) =>
      conversation.scope === "customer_public" &&
      conversation.messages.some(
        (message) =>
          message.authorType === "agent" &&
          typeof message.body === "string" &&
          message.body.includes("cotización preliminar"),
      ),
  );

  expect(
    detail.messages.some(
      (message) =>
        message.authorType === "agent" &&
        typeof message.body === "string" &&
        message.body.includes("cotización preliminar"),
    ),
  ).toBe(true);

});
