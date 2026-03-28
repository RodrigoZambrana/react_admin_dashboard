import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";
const internalToken =
  process.env.PLAYWRIGHT_AI_INTERNAL_TOKEN ?? "local-ai-internal-token";
const adminAssetBase =
  process.env.PLAYWRIGHT_ADMIN_ASSET_BASE_URL ?? "http://127.0.0.1:8080";

test("admin conversations render text, attachment, image, audio and video inside the chat transcript", async ({
  page,
  request,
}) => {
  const timestamp = Date.now();

  const seedResponse = await request.post(
    `${backendBaseUrl}/api/conversations/internal/inbound`,
    {
      headers: {
        "x-ai-internal-token": internalToken,
      },
      data: {
        tenantKey: "urucortinas",
        channel: "whatsapp",
        userId: `5989${timestamp}`.slice(0, 11),
        threadId: `media-thread-${timestamp}`,
        externalMessageId: `media-msg-${timestamp}`,
        displayName: "Cliente multimedia",
        text: "Necesito revisar una imagen, un audio y un adjunto.",
        metadata: {
          provider: "meta",
          image: {
            url: `${adminAssetBase}/mock/dreamschat/video/video.jpg`,
            fileName: "mock-image.jpg",
            contentType: "image/jpeg",
          },
          audio: {
            url: `${adminAssetBase}/mock/dreamschat/audio/audio.mp3`,
            fileName: "mock-audio.mp3",
            contentType: "audio/mpeg",
          },
          video: {
            url: `${adminAssetBase}/mock/dreamschat/video/video.mp4`,
            fileName: "mock-video.mp4",
            contentType: "video/mp4",
            posterUrl: `${adminAssetBase}/mock/dreamschat/video/video.jpg`,
          },
          attachments: [
            {
              url: `${adminAssetBase}/mock/dreamschat/files/mock-note.txt`,
              fileName: "mock-note.txt",
              contentType: "text/plain",
              size: 168,
            },
          ],
        },
      },
    },
  );

  expect(seedResponse.ok()).toBeTruthy();
  const seeded = await seedResponse.json();

  await loginAsAdmin(page);
  await page.goto(
    resolveAdminAppUrl(`/app/crm/conversations/${seeded.conversationId}`),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible({
    timeout: 20_000,
  });

  await expect(page.getByTestId(/admin-conversation-image-/).first()).toBeVisible();
  await expect(page.getByTestId(/admin-conversation-audio-/).first()).toBeVisible();
  await expect(page.getByTestId(/admin-conversation-video-/).first()).toBeVisible();
  await expect(page.getByTestId(/admin-conversation-attachment-/).first()).toBeVisible();
  await expect(page.getByTestId("admin-conversation-messages")).toContainText(
    "Necesito revisar una imagen, un audio y un adjunto.",
  );
});

test("admin conversations allow replying with attachments that stay visible in the transcript", async ({
  page,
  request,
}) => {
  const timestamp = Date.now();

  const seedResponse = await request.post(
    `${backendBaseUrl}/api/conversations/internal/inbound`,
    {
      headers: {
        "x-ai-internal-token": internalToken,
      },
      data: {
        tenantKey: "urucortinas",
        channel: "whatsapp",
        userId: `5989${timestamp}`.slice(0, 11),
        threadId: `reply-thread-${timestamp}`,
        externalMessageId: `reply-msg-${timestamp}`,
        displayName: "Cliente reply adjunto",
        text: "Necesito el plano y el audio por esta vía.",
        metadata: {
          provider: "meta",
        },
      },
    },
  );

  expect(seedResponse.ok()).toBeTruthy();
  const seeded = await seedResponse.json();

  await loginAsAdmin(page);
  await page.goto(
    resolveAdminAppUrl(`/app/crm/conversations/${seeded.conversationId}`),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible({
    timeout: 20_000,
  });

  await page.getByTestId("admin-conversation-reply-file-input").setInputFiles([
    {
      name: "plano.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Plano de referencia con medidas aproximadas."),
    },
    {
      name: "respuesta.webm",
      mimeType: "audio/webm",
      buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]),
    },
  ]);

  await expect(page.getByTestId("admin-conversation-reply-attachments")).toContainText(
    "plano.txt",
  );
  await expect(page.getByTestId("admin-conversation-reply-attachments")).toContainText(
    "respuesta.webm",
  );

  await page.getByTestId("admin-conversation-reply-submit").click();

  await expect(page.getByTestId("admin-conversation-messages")).toContainText(
    "plano.txt",
    {
      timeout: 20_000,
    },
  );
  await expect(page.getByTestId(/admin-conversation-attachment-/).last()).toBeVisible();
});
