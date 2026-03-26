import { expect, test, type APIRequestContext } from "@playwright/test";

import { signInAdmin } from "./support/admin-api";
import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

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
    `Conversation ${conversationId} did not reach the expected state. Last detail: ${JSON.stringify(lastDetail, null, 2)}`,
  );
}

test("admin internal chat structures aberturas for insert and keeps missing price as pending", async ({
  page,
  request,
}) => {
  const startedAt = new Date().toISOString();
  const adminToken = await signInAdmin(request);
  const prompt =
    "Necesito agregar estas aberturas al sistema: Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234; Gala corrediza con DVH color negro de 1.90 x 2.20";

  const contactsResponse = await request.get(
    `${backendBaseUrl}/api/conversations/contacts?search=${encodeURIComponent("Asistente")}&limit=10`,
    {
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    },
  );
  expect(contactsResponse.ok()).toBeTruthy();
  const contactsPayload = (await contactsResponse.json()) as {
    items: Array<{ key: string; conversationId: string | null }>;
  };
  const internalContact = contactsPayload.items.find(
    (item) => item.key === "internal:assistant",
  );
  expect(internalContact).toBeTruthy();

  let conversationId = internalContact?.conversationId ?? null;
  if (!conversationId) {
    const sessionResponse = await request.post(
      `${backendBaseUrl}/api/conversations/contact-session`,
      {
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        data: {
          contactType: "internal",
        },
      },
    );
    expect(sessionResponse.ok()).toBeTruthy();
    const sessionPayload = (await sessionResponse.json()) as { id: string };
    conversationId = sessionPayload.id;
  }
  expect(conversationId).toBeTruthy();

  await loginAsAdmin(page);
  await page.goto(
    resolveAdminAppUrl(`/app/crm/conversations/${conversationId}`),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("admin-conversation-reply-input").fill(prompt);
  await page.getByTestId("admin-conversation-reply-submit").click();

  await expect(page).toHaveURL(
    new RegExp(`/app/crm/conversations/${conversationId}$`),
  );
  await expect(page.getByTestId("admin-conversation-messages")).toContainText(
    "Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234",
    {
      timeout: 20_000,
    },
  );

  const detail = await waitForConversationState(
    request,
    adminToken,
    conversationId as string,
    (conversation) => {
      const hasInsertTool = conversation.toolCalls.some(
        (toolCall) =>
          toolCall.toolName === "prepare_aberturas_insert" &&
          toolCall.status.toLowerCase() === "executed" &&
          toolCall.updatedAt >= startedAt,
      );
      const hasFreshAgentReply = conversation.messages.some(
        (message) =>
          message.authorType === "agent" &&
          message.createdAt >= startedAt &&
          typeof message.body === "string" &&
          message.body.length > 0,
      );
      return hasInsertTool && hasFreshAgentReply;
    },
  );

  const latestAgentReply = [...detail.messages]
    .reverse()
    .find(
      (message) =>
        message.authorType === "agent" &&
        message.createdAt >= startedAt &&
        typeof message.body === "string" &&
        message.body.length > 0,
    );

  expect(detail.scope).toBe("admin_internal");
  expect(
    detail.toolCalls.some(
      (toolCall) =>
        toolCall.toolName === "prepare_aberturas_insert" &&
        toolCall.updatedAt >= startedAt,
    ),
  ).toBeTruthy();
  expect(
    detail.toolCalls.some(
      (toolCall) =>
        toolCall.toolName === "prepare_aberturas_quote" &&
        toolCall.updatedAt >= startedAt,
    ),
  ).toBeFalsy();
  expect(latestAgentReply?.body ?? "").toContain("234");
  expect(latestAgentReply?.body ?? "").toMatch(/falta|pendient/i);
  expect(latestAgentReply?.body ?? "").not.toContain("142");
  expect(latestAgentReply?.body ?? "").not.toMatch(/cotización disponible|precio estimado/i);
  await expect(page.getByTestId("admin-conversation-messages")).toContainText("234");
});

test("storefront customer chat asks for the same abertura and receives a customer-safe quote response", async ({
  page,
  request,
}) => {
  const adminToken = await signInAdmin(request);
  const knowledgeTitle = `E2E customer aberturas quote ${Date.now()}`;
  const knowledgeResponse = await request.post(
    `${backendBaseUrl}/api/ai/knowledge/curated`,
    {
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      data: {
        tenantKey: "urucortinas",
        scope: "customer_public",
        title: knowledgeTitle,
        summary: "Cotización pública de referencia para una abertura Probba.",
        content:
          "Cotización pública de referencia UruCortinas. Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234. Responder al cliente en tono comercial, sin mencionar alta al sistema, insert payload ni lista de productos.",
        tags: ["e2e", "urucortinas", "aberturas", "customer_public"],
      },
    },
  );
  expect(knowledgeResponse.ok()).toBeTruthy();
  const knowledgeDocument = (await knowledgeResponse.json()) as { id: string };

  try {
    await page.goto("http://127.0.0.1:3000/", {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("storefront-webchat-launcher").evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(page.getByTestId("storefront-webchat-drawer")).toBeVisible();

    const startedAt = new Date().toISOString();
    const prompt =
      "Quiero cotización para una corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120, con las mismas características.";

    await page.getByTestId("storefront-webchat-input").fill(prompt);
    await page.getByTestId("storefront-webchat-send").click();

    await expect(
      page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
    ).toContainText("corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120", {
      timeout: 20_000,
    });
    await expect(
      page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
    ).toBeVisible({ timeout: 30_000 });

    const sessionRaw = await page.evaluate(() =>
      window.localStorage.getItem("storefront.webchat.session.v1"),
    );
    expect(sessionRaw).toBeTruthy();
    const session = JSON.parse(sessionRaw as string) as { conversationId: string };
    expect(session.conversationId).toBeTruthy();

    const detail = await waitForConversationState(
      request,
      adminToken,
      session.conversationId,
      (conversation) =>
        conversation.messages.some(
          (message) =>
            message.authorType === "agent" &&
            message.createdAt >= startedAt &&
            typeof message.body === "string" &&
            message.body.length > 0,
        ),
    );

    const latestAgentReply = [...detail.messages]
      .reverse()
      .find(
        (message) =>
          message.authorType === "agent" &&
          message.createdAt >= startedAt &&
          typeof message.body === "string" &&
          message.body.length > 0,
      );

    expect(detail.scope).toBe("customer_public");
    expect(latestAgentReply?.body ?? "").toContain("234");
    expect(latestAgentReply?.body ?? "").toMatch(/cotización|asesor|presupuesto/i);
    expect(latestAgentReply?.body ?? "").not.toMatch(
      /alta al sistema|lista de productos|payload|insert/i,
    );

    await expect(
      page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
    ).toContainText("234");
  } finally {
    await request.delete(
      `${backendBaseUrl}/api/ai/knowledge/documents/${knowledgeDocument.id}`,
      {
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      },
    );
  }
});
