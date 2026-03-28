import { Buffer } from "node:buffer";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { storefrontBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";

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

async function sendStorefrontMessageWithEnter(page: Page, text: string) {
  const input = page.getByTestId("storefront-webchat-input");
  await input.fill(text);
  await input.press("Enter");

  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(text, { timeout: 20_000 });
  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 30_000 });
}

async function readStoredWebchatSession(page: Page) {
  const sessionRaw = await page.evaluate(() =>
    window.localStorage.getItem("storefront.webchat.session.v1"),
  );
  expect(sessionRaw).toBeTruthy();
  return JSON.parse(sessionRaw as string) as {
    conversationId: string;
    scope: string;
  };
}

async function createWebchatSessionSnapshot(
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
      content?: string;
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

  const effectiveGuestId = sessionPayload.guestId ?? input.guestId;
  const messageResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/message`,
    {
      data: {
        conversationId: sessionPayload.conversationId,
        guestId: effectiveGuestId,
        text: input.text,
        attachments: input.attachments ?? [],
      },
    },
  );

  expect(messageResponse.ok()).toBeTruthy();

  const transcriptResponse = await request.get(
    `${backendBaseUrl}/api/conversations/webchat/session/${sessionPayload.conversationId}?guestId=${encodeURIComponent(
      effectiveGuestId,
    )}`,
  );

  expect(transcriptResponse.ok()).toBeTruthy();
  return transcriptResponse.json();
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

  const session = await readStoredWebchatSession(page);
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

test("public storefront webchat can start a new chat without restoring the previous transcript after reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  const firstPrompt = "Quiero presupuesto para una roller blackout.";
  await sendStorefrontMessage(page, firstPrompt);

  const firstSession = await readStoredWebchatSession(page);
  await expect(page.getByTestId("storefront-webchat-restart")).toBeVisible();

  await page.getByTestId("storefront-webchat-restart").click();

  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]'),
  ).toHaveCount(0);
  await expect(page.getByText("Hola. ¿En qué podemos ayudarte hoy?")).toBeVisible();

  const secondSession = await readStoredWebchatSession(page);
  expect(secondSession.scope).toBe("customer_public");
  expect(secondSession.conversationId).not.toBe(firstSession.conversationId);

  const secondPrompt = "Necesito saber horarios.";
  await sendStorefrontMessage(page, secondPrompt);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openStorefrontChat(page);

  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText(secondPrompt, {
    timeout: 20_000,
  });
  await expect(page.getByText(firstPrompt)).toHaveCount(0);
});

test("storefront webchat keeps greetings short and topic answers focused", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  await sendStorefrontMessage(page, "Hola buenos días");
  const greetingReply = page
    .locator('[data-testid="storefront-webchat-message-agent"]')
    .last();
  await expect(greetingReply).toContainText("¿En qué podemos ayudarte", {
    timeout: 30_000,
  });
  await expect(greetingReply).not.toContainText(/productos,\s*precios,\s*env[ií]os/i);

  await sendStorefrontMessage(page, "Quiero saber si tienen cortinas roller");
  const focusedReply = page
    .locator('[data-testid="storefront-webchat-message-agent"]')
    .last();
  await expect(focusedReply).toContainText(/roller/i, {
    timeout: 30_000,
  });
  await expect(focusedReply).not.toContainText(
    /bandas verticales|venecianas|persianas|automatizaci[oó]n|dvh/i,
  );
});

test("storefront webchat sends with Enter and keeps Shift+Enter for multiline draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  const input = page.getByTestId("storefront-webchat-input");
  await input.fill("Primera línea");
  await input.press("Shift+Enter");
  await input.type("segunda línea");
  await expect(input).toHaveValue("Primera línea\nsegunda línea");

  await sendStorefrontMessageWithEnter(page, "Quiero saber el horario");
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

  const session = await readStoredWebchatSession(page);
  expect(session.scope).toBe("customer_authenticated");
  await expect(page.getByTestId("storefront-webchat-restart")).toHaveCount(0);

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

test("storefront webchat renders attachment types and interpreted message elements from transcript history", async ({
  page,
  request,
}) => {
  const guestId = `multimodal-${Date.now()}`;
  const sessionSnapshot = await createWebchatSessionSnapshot(request, {
    guestId,
    name: "Contexto multimodal",
    email: `${guestId}@example.com`,
    text: "Te comparto imagen, audio, documento y planilla para revisar todo junto.",
    attachments: [
      {
        assetType: "image",
        fileName: "abertura.jpg",
        contentType: "image/png",
        content:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0eQAAAAASUVORK5CYII=",
        textContent: "Ventana corrediza probba blanco 120 x 150.",
      },
      {
        assetType: "audio",
        fileName: "consulta.webm",
        contentType: "audio/webm",
        content: "data:audio/webm;base64,GkXfo59ChoE=",
        textContent: "Necesito coordinar una visita y confirmar el precio.",
      },
      {
        assetType: "pdf",
        fileName: "detalle.pdf",
        contentType: "application/pdf",
        textContent: "Detalle de medidas y terminaciones del proyecto.",
      },
      {
        assetType: "csv",
        fileName: "items.csv",
        contentType: "text/csv",
        textContent: "producto,precio\nroller blackout,500",
      },
    ],
  });

  await page.addInitScript((session) => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem(
      "storefront.webchat.session.v1",
      JSON.stringify(session),
    );
  }, sessionSnapshot);

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText("Te comparto imagen, audio, documento y planilla", {
    timeout: 20_000,
  });

  const attachments = page.locator(
    '[data-testid^="storefront-webchat-attachment-"]',
  );
  await expect(attachments).toHaveCount(4);
  await expect(attachments.nth(0)).toContainText("Imagen");
  await expect(attachments.nth(1)).toContainText("Audio");
  await expect(attachments.nth(2)).toContainText("Documento");
  await expect(attachments.nth(3)).toContainText("Tabla");
  await expect(page.getByTestId(/storefront-webchat-image-/).first()).toBeVisible();
  await expect(page.getByTestId(/storefront-webchat-audio-/).first()).toBeVisible();

  const elementSummary = page.locator(
    '[data-testid^="storefront-webchat-elements-"]',
  ).last();
  await expect(elementSummary).toContainText("Imagen");
  await expect(elementSummary).toContainText("Audio");
  await expect(elementSummary).toContainText("Documento");
  await expect(elementSummary).toContainText("Tabla");
});

test("storefront webchat can attach files and send text plus attachments from the composer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
  });

  await page.goto(storefrontBaseUrl, {
    waitUntil: "domcontentloaded",
  });
  await openStorefrontChat(page);

  await page.getByTestId("storefront-webchat-file-input").setInputFiles([
    {
      name: "consulta.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Necesito confirmar si hacen instalación y el horario de atención."),
    },
    {
      name: "consulta.webm",
      mimeType: "audio/webm",
      buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]),
    },
  ]);

  await expect(page.getByTestId("storefront-webchat-composer-attachments")).toContainText(
    "consulta.txt",
  );
  await expect(page.getByTestId("storefront-webchat-composer-attachments")).toContainText(
    "consulta.webm",
  );

  await page
    .getByTestId("storefront-webchat-input")
    .fill("Te adjunto audio y archivo para revisar.");
  await page.getByTestId("storefront-webchat-send").click();

  const lastCustomerMessage = page
    .locator('[data-testid="storefront-webchat-message-customer"]')
    .last();
  await expect(lastCustomerMessage).toContainText("Te adjunto audio y archivo para revisar.", {
    timeout: 20_000,
  });
  await expect(
    page.locator('[data-testid^="storefront-webchat-attachment-"]').filter({
      hasText: "consulta.txt",
    }),
  ).toHaveCount(1, { timeout: 20_000 });
  await expect(
    page.locator('[data-testid^="storefront-webchat-attachment-"]').filter({
      hasText: "consulta.webm",
    }),
  ).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId(/storefront-webchat-audio-/).last()).toBeVisible({
    timeout: 20_000,
  });

  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 30_000 });
});
