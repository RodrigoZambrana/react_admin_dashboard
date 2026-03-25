import { expect, test, type APIRequestContext } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";

async function seedWebchatConversation(
  request: APIRequestContext,
  options: {
    guestId: string;
    name: string;
    email: string;
    text: string;
  },
) {
  const sessionResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: options.guestId,
        name: options.name,
        email: options.email,
        locale: "es-UY",
        page: "/shop",
      },
    },
  );

  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = await sessionResponse.json();

  const messageResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/message`,
    {
      data: {
        conversationId: sessionPayload.conversationId,
        guestId: options.guestId,
        text: options.text,
      },
    },
  );

  expect(messageResponse.ok()).toBeTruthy();

  return {
    conversationId: String(sessionPayload.conversationId),
  };
}

test("admin messaging regression covers filters, pin, unread state, reply and mail navigation", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const targetMessage = `Necesito ayuda con el flujo ${uniqueId}`;
  const target = await seedWebchatConversation(request, {
    guestId: `regression-target-${uniqueId}`,
    name: `Regresion Operativa ${uniqueId}`,
    email: `regression-target-${uniqueId}@example.com`,
    text: targetMessage,
  });
  const secondary = await seedWebchatConversation(request, {
    guestId: `regression-secondary-${uniqueId}`,
    name: `Secundaria ${uniqueId}`,
    email: `regression-secondary-${uniqueId}@example.com`,
    text: `Conversación secundaria ${uniqueId}`,
  });

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-conversations-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId(`admin-conversation-${target.conversationId}`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId(`admin-conversation-${secondary.conversationId}`)).toBeVisible({
    timeout: 20_000,
  });

  const targetRow = page.getByTestId(`admin-conversation-${target.conversationId}`);
  const targetMenuButton = targetRow.locator(
    "xpath=../button[@aria-label='Acciones del chat']",
  );

  await page.getByTestId("admin-conversations-rail-filters").click();
  await expect(page.getByTestId("admin-conversations-filter-search")).toBeVisible();
  await page
    .getByTestId("admin-conversations-filter-search")
    .fill(targetMessage);
  await page.getByTestId("admin-conversations-filter-reset").click();

  await expect(targetRow).toBeVisible();
  await expect(page.getByTestId(`admin-conversation-${secondary.conversationId}`)).toBeVisible();

  await targetMenuButton.click();
  await page.getByTestId(`admin-conversation-menu-pin-${target.conversationId}`).click();
  await expect(
    page.getByTestId(`admin-conversation-pin-indicator-${target.conversationId}`),
  ).toBeVisible();
  await targetMenuButton.click();
  await page.getByTestId(`admin-conversation-menu-pin-${target.conversationId}`).click();
  await expect(
    page.getByTestId(`admin-conversation-pin-indicator-${target.conversationId}`),
  ).toHaveCount(0);
  await targetMenuButton.click();
  await page.getByTestId(`admin-conversation-menu-pin-${target.conversationId}`).click();
  await expect(
    page.getByTestId(`admin-conversation-pin-indicator-${target.conversationId}`),
  ).toBeVisible();

  await targetRow.click();
  await expect(page).toHaveURL(
    new RegExp(`/app/crm/conversations/${target.conversationId}$`),
  );
  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible();

  await page
    .getByTestId("admin-conversation-reply-input")
    .fill(`Respuesta operador ${uniqueId}`);
  await page.getByTestId("admin-conversation-reply-submit").click();
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: `Respuesta operador ${uniqueId}`,
    }).last(),
  ).toBeVisible({ timeout: 20_000 });

  await expect(
    page.getByTestId(`admin-conversation-unread-count-${target.conversationId}`),
  ).toHaveCount(0);

  await targetMenuButton.click();
  await expect(
    page.getByTestId(`admin-conversation-menu-read-toggle-${target.conversationId}`),
  ).toContainText(/Marcar como (no )?leído/);
  await page.keyboard.press("Escape");

  await page.getByTestId(`admin-conversation-${target.conversationId}`).click();

  await page.getByTestId("admin-conversations-rail-mail").click();
  await expect(page).toHaveURL(/\/app\/crm\/mail(\/inbox)?/);
  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({
    timeout: 20_000,
  });
});
