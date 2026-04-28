import { expect, test } from "@playwright/test";

const aiPlatformBaseUrl =
  process.env.PLAYWRIGHT_AI_PLATFORM_URL ?? "http://127.0.0.1:4110";

async function getJson<T>(request: any, path: string) {
  const response = await request.get(`${aiPlatformBaseUrl}${path}`);
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<T>;
}

test("channel control settings persist through the ai-platform contract surface", async ({
  request,
}) => {
  const uniqueId = Date.now();
  const emailPath = "/settings/channels/email";
  const metaPath = "/settings/channels/meta";
  const whatsappPath = "/settings/channels/whatsapp-qr";

  const emailBefore = await getJson<any>(request, emailPath);
  const metaBefore = await getJson<any>(request, metaPath);
  const whatsappBefore = await getJson<any>(request, whatsappPath);

  const tempEmailName = `QA Inbox ${uniqueId}`;
  const tempMetaPageId = `qa-page-${uniqueId}`;
  const tempWhatsappName = `WhatsApp QA ${uniqueId}`;

  try {
    const emailResponse = await request.put(`${aiPlatformBaseUrl}${emailPath}`, {
      data: {
        fromName: tempEmailName,
      },
    });
    expect(emailResponse.ok()).toBeTruthy();
    const emailAfterUpdate = await emailResponse.json();
    expect(emailAfterUpdate.source).toBe("database");
    expect(emailAfterUpdate.fromName).toBe(tempEmailName);

    const metaResponse = await request.put(`${aiPlatformBaseUrl}${metaPath}`, {
      data: {
        pageId: tempMetaPageId,
      },
    });
    expect(metaResponse.ok()).toBeTruthy();
    const metaAfterUpdate = await metaResponse.json();
    expect(metaAfterUpdate.meta.source).toBe("database");
    expect(metaAfterUpdate.config.pageId).toBe(tempMetaPageId);

    const whatsappResponse = await request.put(`${aiPlatformBaseUrl}${whatsappPath}`, {
      data: {
        displayName: tempWhatsappName,
      },
    });
    expect(whatsappResponse.ok()).toBeTruthy();
    const whatsappAfterUpdate = await whatsappResponse.json();
    expect(whatsappAfterUpdate.config.displayName).toBe(tempWhatsappName);
    expect(whatsappAfterUpdate.consistency.inboxActiveMatchesConfig).toBe(true);

    const emailAfterReload = await getJson<any>(request, emailPath);
    expect(emailAfterReload.fromName).toBe(tempEmailName);
    expect(emailAfterReload.source).toBe("database");

    const metaAfterReload = await getJson<any>(request, metaPath);
    expect(metaAfterReload.config.pageId).toBe(tempMetaPageId);
    expect(metaAfterReload.meta.source).toBe("database");

    const whatsappAfterReload = await getJson<any>(request, whatsappPath);
    expect(whatsappAfterReload.config.displayName).toBe(tempWhatsappName);
    expect(whatsappAfterReload.consistency.inboxAccountPresent).toBe(true);
  } finally {
    await request.put(`${aiPlatformBaseUrl}${emailPath}`, {
      data: {
        fromName: emailBefore.fromName ?? null,
      },
    });
    await request.put(`${aiPlatformBaseUrl}${metaPath}`, {
      data: {
        pageId: metaBefore.config.pageId ?? null,
      },
    });
    await request.put(`${aiPlatformBaseUrl}${whatsappPath}`, {
      data: {
        displayName: whatsappBefore.config.displayName ?? null,
      },
    });
  }
});
