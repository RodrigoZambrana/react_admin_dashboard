import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  createAdminInternalSessionForUser,
  createManagedAdminUser,
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
      },
    },
  );

  expect(messageResponse.ok()).toBeTruthy();

  return sessionPayload;
}

async function openInternalAssistantContact(page: Page) {
  await page.getByTestId("admin-conversations-new-chat").click();
  await expect(page.getByTestId("admin-conversations-contact-list")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("admin-conversations-contact-search").fill("Agente IA");
  const contact = page.getByTestId("admin-conversations-contact-internal-assistant");
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
      page.getByTestId(`admin-conversation-${created[0]?.conversationId}`),
    ).toBeVisible({ timeout: 20_000 });

    const scrollTopBefore = await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });

    expect(scrollTopBefore).toBeGreaterThan(100);

    const conversationRows = list.locator(
      'button.chat-user-list[data-testid^="admin-conversation-"]',
    );
    const rowCount = await conversationRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(10);

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

    const scrollTopAfter = await list.evaluate((element) => element.scrollTop);
    expect(scrollTopAfter).toBeGreaterThan(100);
    expect(Math.abs(scrollTopAfter - scrollTopBefore)).toBeLessThan(220);
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
});
