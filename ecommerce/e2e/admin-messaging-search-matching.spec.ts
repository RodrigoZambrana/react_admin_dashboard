import { expect, test, type APIRequestContext } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { aiPlatformApiBaseUrl } from "./support/env";

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
    `${aiPlatformApiBaseUrl}/chat/public/webchat/session`,
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
    `${aiPlatformApiBaseUrl}/chat/public/webchat/messages`,
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

test("admin messaging search matches and filters conversation results", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const targetName = `Busqueda Exacta ${uniqueId}`;
  const secondaryName = `Secundaria Visible ${uniqueId}`;

  const target = await seedWebchatConversation(request, {
    guestId: `search-target-${uniqueId}`,
    name: targetName,
    email: `search-target-${uniqueId}@example.com`,
    text: `Consulta de búsqueda ${uniqueId}`,
  });
  const secondary = await seedWebchatConversation(request, {
    guestId: `search-secondary-${uniqueId}`,
    name: secondaryName,
    email: `search-secondary-${uniqueId}@example.com`,
    text: `Otra consulta ${uniqueId}`,
  });

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-conversations-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByTestId(`admin-conversation-${target.conversationId}`),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByTestId(`admin-conversation-${secondary.conversationId}`),
  ).toBeVisible({
    timeout: 20_000,
  });

  await page.getByTestId("admin-conversations-search-input").fill(targetName);

  await expect(
    page.getByTestId(`admin-conversation-${target.conversationId}`),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByTestId(`admin-conversation-${secondary.conversationId}`),
  ).toHaveCount(0);

  await page.getByTestId("admin-conversations-search-input").fill("");

  await expect(
    page.getByTestId(`admin-conversation-${secondary.conversationId}`),
  ).toBeVisible({
    timeout: 20_000,
  });
});
