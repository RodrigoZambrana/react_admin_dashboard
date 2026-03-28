import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  createAdminInternalSessionForUser,
  createManagedAdminUser,
  startAdminInternalAssistantConversationForUser,
} from "./support/admin-api";
import { loginAsAdmin, loginAsAdminUser, resolveAdminAppUrl } from "./support/admin-ui";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";

async function createWebchatConversation(
  request: APIRequestContext,
  input: {
    guestId: string;
    name: string;
    email: string;
    text: string;
    authenticated?: boolean;
    attachments?: Array<{
      assetType?: string;
      fileName?: string;
      contentType?: string;
      textContent?: string;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  const sessionResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: input.guestId,
        name: input.name,
        email: input.email,
        locale: "es-UY",
        page: "/shop",
        authenticated: input.authenticated ?? false,
      },
    },
  );

  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = (await sessionResponse.json()) as {
    conversationId: string;
    guestId?: string | null;
  };

  const messageResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/message`,
    {
      data: {
        conversationId: sessionPayload.conversationId,
        guestId: sessionPayload.guestId ?? input.guestId,
        text: input.text,
        attachments: input.attachments ?? [],
      },
    },
  );

  expect(messageResponse.ok()).toBeTruthy();
  const messagePayload = (await messageResponse.json()) as {
    message?: {
      id?: string;
    };
  };

  return {
    ...sessionPayload,
    messageId: messagePayload.message?.id ?? null,
  };
}

async function createWebchatConversationWithAgentReply(
  request: APIRequestContext,
  input: {
    guestId: string;
    name: string;
    email: string;
    text: string;
    authenticated?: boolean;
  },
) {
  const sessionResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: input.guestId,
        name: input.name,
        email: input.email,
        locale: "es-UY",
        page: "/shop",
        authenticated: input.authenticated ?? false,
      },
    },
  );

  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = (await sessionResponse.json()) as {
    conversationId: string;
    guestId?: string | null;
  };

  const effectiveGuestId = sessionPayload.guestId ?? input.guestId;
  const dispatchResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/dispatch`,
    {
      data: {
        tenantKey: "urucortinas",
        conversationId: sessionPayload.conversationId,
        guestId: effectiveGuestId,
        userId: effectiveGuestId,
        scope: input.authenticated ? "customer_authenticated" : "customer_public",
        text: input.text,
        metadata: {
          page: "/shop",
        },
      },
    },
  );

  expect(dispatchResponse.ok()).toBeTruthy();
  return sessionPayload;
}

async function openInternalAssistantContact(page: Page) {
  await page.getByTestId("admin-conversations-new-chat").click();
  await expect(page.getByTestId("admin-conversations-contact-list")).toBeVisible({
    timeout: 20_000,
  });
  const searchInput = page.getByTestId("admin-conversations-contact-search");
  const contact = page.getByTestId("admin-conversations-contact-internal-assistant");
  if (!(await contact.isVisible().catch(() => false))) {
    await searchInput.fill("Agente IA");
  }
  if (!(await contact.isVisible().catch(() => false))) {
    await searchInput.fill("Asistente interno");
  }
  await expect(contact).toBeVisible({ timeout: 20_000 });
  await expect(contact).toContainText("Asistente interno");
  await contact.click();
  return contact;
}

test.describe.serial("admin inbox regression", () => {
  test("selecting a conversation keeps the inbox scroll position", async ({
    page,
    request,
  }) => {
    const uniquePrefix = `scroll-${Date.now()}`;
    const created: Array<{ conversationId: string; name: string }> = [];

    for (let index = 0; index < 18; index += 1) {
      const seeded = await createWebchatConversation(request, {
        guestId: `${uniquePrefix}-guest-${index}`,
        name: `Inbox Scroll ${uniquePrefix} ${index.toString().padStart(2, "0")}`,
        email: `${uniquePrefix}-${index}@example.com`,
        text: `Mensaje scroll ${uniquePrefix} ${index}`,
      });

      created.push({
        conversationId: seeded.conversationId,
        name: `Inbox Scroll ${uniquePrefix} ${index.toString().padStart(2, "0")}`,
      });
    }

    await loginAsAdmin(page);
    await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
      waitUntil: "domcontentloaded",
    });
    await page.getByTestId("admin-conversations-search-input").fill(uniquePrefix);

    const list = page.getByTestId("admin-conversations-list");
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByTestId("admin-conversations-list-refresh-indicator"),
    ).toContainText(`Cargadas ${created.length} de ${created.length} conversaciones`, {
      timeout: 20_000,
    });

    const scrollTopBefore = await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });

    expect(scrollTopBefore).toBeGreaterThan(20);

    const conversationRows = list.locator(
      'button.chat-user-list[data-testid^="admin-conversation-"]',
    );
    const rowCount = await conversationRows.count();
    expect(rowCount).toBe(created.length);

    const targetRow = conversationRows.nth(rowCount - 1);
    const targetTestId = await targetRow.getAttribute("data-testid");
    const targetConversationId = targetTestId?.replace("admin-conversation-", "") ?? "";
    expect(targetConversationId).toBeTruthy();

    const target =
      created.find((entry) => entry.conversationId === targetConversationId) ?? null;
    expect(target).toBeTruthy();
    await expect(targetRow).toContainText(target?.name ?? "");
    await targetRow.click();

    await expect(page).toHaveURL(
      new RegExp(`/app/crm/conversations/${targetConversationId}$`),
    );
    await expect(page.getByTestId("admin-conversation-detail-title")).toContainText(
      target?.name ?? "",
      { timeout: 20_000 },
    );
    await expect(page.getByTestId("admin-conversation-details-open")).toBeVisible();
    await expect(page.getByTestId("admin-conversation-reply-input")).toBeVisible();
    await expect(page.getByTestId("admin-conversation-reply-submit")).toBeVisible();

    await expect
      .poll(
        async () =>
          list.evaluate(
            (element, before) => Math.abs(element.scrollTop - before),
            scrollTopBefore,
          ),
        {
          timeout: 2_000,
        },
      )
      .toBeLessThan(220);

    const scrollTopAfter = await list.evaluate(
      (element, before) => ({
        top: element.scrollTop,
        delta: Math.abs(element.scrollTop - before),
      }),
      scrollTopBefore,
    );
    expect(scrollTopAfter.top).toBeGreaterThan(20);
    expect(scrollTopAfter.delta).toBeLessThan(220);
    await expect(targetRow).toBeVisible();
  });

  test("the inbox preview shows the latest agent message and the IA modal reopens the same thread", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const email = `ia.inbox.${uniqueId}@example.com`;
    const password = `InboxAgent@${uniqueId}`;
    const subject = "Agente IA";
    const message = `Necesito ayuda con el presupuesto ${uniqueId}`;

    await createManagedAdminUser(request, {
      name: "Inbox",
      lastName: "Agent",
      email,
      password,
      role: "ADMIN",
      capabilityGroups: ["support"],
    });

    const conversation = await createAdminInternalSessionForUser(
      request,
      { email, password },
      {
        subject,
        message,
      },
    );

    await loginAsAdminUser(page, { email, password });
    await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
      waitUntil: "domcontentloaded",
    });

    const row = page.getByTestId(`admin-conversation-${conversation.id}`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText("IA:");

    const contact = await openInternalAssistantContact(page);
    await expect(contact).toContainText("Existente");
    await page.getByTestId("admin-conversations-start-message").click();

    await expect(page).toHaveURL(
      new RegExp(`/app/crm/conversations/${conversation.id}$`),
      { timeout: 20_000 },
    );

    await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
      waitUntil: "domcontentloaded",
    });

    const reopenedContact = await openInternalAssistantContact(page);
    await expect(reopenedContact).toContainText("Existente");
    await page.getByTestId("admin-conversations-start-message").click();

    await expect(page).toHaveURL(
      new RegExp(`/app/crm/conversations/${conversation.id}$`),
      { timeout: 20_000 },
    );
  });

  test("internal chat channel shows only the current operator assistant thread and stops paginating at the end", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const users = await Promise.all(
      ["one", "two", "three"].map(async (suffix) => {
        const email = `ia.filter.${suffix}.${uniqueId}@example.com`;
        const password = `InboxFilter@${uniqueId}${suffix}`;
        await createManagedAdminUser(request, {
          name: `Inbox ${suffix}`,
          lastName: "Filter",
          email,
          password,
          role: "ADMIN",
          capabilityGroups: ["support"],
        });

        const conversation = await startAdminInternalAssistantConversationForUser(
          request,
          { email, password },
        );

        return { email, password, conversation };
      }),
    );

    const current = users[0];

    await loginAsAdminUser(page, {
      email: current.email,
      password: current.password,
    });
    await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("admin-conversations-rail-directory").click();
    await expect(page.getByTestId("admin-conversations-channels")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("admin-conversations-channel-admin_chat").click();
    await expect(
      page.getByTestId("admin-conversations-list-refresh-indicator"),
    ).toContainText("Cargadas 1 de 1 conversaciones", {
      timeout: 20_000,
    });

    const rows = page.locator(
      'button.chat-user-list[data-testid^="admin-conversation-"]',
    );
    await expect(rows).toHaveCount(1, { timeout: 20_000 });
    await expect(rows.first()).toContainText(/Agente IA|Asistente interno/, {
      timeout: 20_000,
    });

    const list = page.getByTestId("admin-conversations-list");
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await expect(
      page.getByTestId("admin-conversations-list-more-indicator"),
    ).toContainText("No hay más conversaciones por cargar en este listado.", {
      timeout: 20_000,
    });
  });

  test("webchat cards show the latest agent preview after a public greeting", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const guestId = `preview-agent-${uniqueId}`;
    const email = `preview.agent.${uniqueId}@example.com`;
    const name = `Preview Agent ${uniqueId}`;

    const conversation = await createWebchatConversationWithAgentReply(request, {
      guestId,
      name,
      email,
      text: "Hola",
    });

    await loginAsAdmin(page);
    await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("admin-conversations-search-input").fill(guestId);
    const row = page.getByTestId(`admin-conversation-${conversation.conversationId}`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText("IA:");
    await expect(row).toContainText("¿En qué podemos ayudarte hoy?", {
      timeout: 20_000,
    });
  });

  test("conversation detail shows per-message interpreted context for attachment-based customer messages", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const guestId = `message-elements-${uniqueId}`;
    const email = `message.elements.${uniqueId}@example.com`;
    const name = `Message Elements ${uniqueId}`;

    const conversation = await createWebchatConversation(request, {
      guestId,
      name,
      email,
      text: "Registralo según el audio adjunto",
      attachments: [
        {
          assetType: "audio",
          fileName: "nota.webm",
          contentType: "audio/webm",
          textContent:
            "Registrar cliente Carlos Rodriguez con correo carlos@example.com",
        },
      ],
    });

    expect(conversation.messageId).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("admin-conversations-search-input").fill(guestId);
    const row = page.getByTestId(`admin-conversation-${conversation.conversationId}`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();

    await expect(page).toHaveURL(
      new RegExp(`/app/crm/conversations/${conversation.conversationId}$`),
    );
    const interpretedContext = page.getByText("Contexto interpretado").last();
    await expect(interpretedContext).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Origen:\s*message_text/i).last()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/nota\.webm/i).last()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Carlos Rodriguez/i).last()).toBeVisible({
      timeout: 20_000,
    });
  });
});
