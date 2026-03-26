import { expect, test, type Page } from "@playwright/test";

import { storefrontBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";

async function openStorefrontChat(page: Page) {
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

async function sendStorefrontMessage(page: Page, text: string) {
  await page.getByTestId("storefront-webchat-input").fill(text);
  await page.getByTestId("storefront-webchat-send").click();

  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(text, { timeout: 20_000 });
  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 30_000 });
}

test("public storefront webchat uses floating bubble, sends a message and restores canonical transcript after reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  await expect(page.getByTestId("storefront-webchat-mode")).toContainText("Asistente IA");
  await expect(page.getByTestId("storefront-webchat-status")).toBeVisible();

  await sendStorefrontMessage(page, "Quiero precio de cortina roller");

  const sessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(sessionRaw).toBeTruthy();
  const session = JSON.parse(sessionRaw as string) as {
    conversationId: string;
    scope: string;
  };
  expect(session.conversationId).toBeTruthy();
  expect(session.scope).toBe("customer_public");

  await page.reload({ waitUntil: "domcontentloaded" });
  await openStorefrontChat(page);
  await expect(page.getByTestId("storefront-webchat-mode")).toContainText(/Asistente IA|IA \+ equipo|Asesor humano/i);
  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText("Quiero precio de cortina roller", {
    timeout: 20_000,
  });
  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 30_000 });
});

test("authenticated storefront webchat keeps authenticated scope and restores transcript after reload", async ({
  page,
}) => {
  const customer = buildTestCustomer();

  await registerCustomer(page.request, customer);

  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  await expect(page.getByTestId("storefront-webchat-mode")).toContainText("Asistente IA");
  await expect(page.getByText("Cliente identificado")).toBeVisible();

  const prompt = "Necesito ayuda con mi pedido y saber si tienen instalación.";
  await sendStorefrontMessage(page, prompt);

  const sessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(sessionRaw).toBeTruthy();
  const session = JSON.parse(sessionRaw as string) as {
    conversationId: string;
    scope: string;
  };
  expect(session.scope).toBe("customer_authenticated");

  await page.reload({ waitUntil: "domcontentloaded" });
  await openStorefrontChat(page);
  await expect(page.getByText("Cliente identificado")).toBeVisible();
  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(prompt, {
    timeout: 20_000,
  });
  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 30_000 });
});
