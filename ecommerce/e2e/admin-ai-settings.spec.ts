import { expect, test } from "@playwright/test";
import path from "node:path";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin can open AI runtime settings and see usage warnings", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("ai-runtime-settings-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("ai-runtime-usage-alert")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-provider")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-model")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-limit")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-threshold")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-admin-prompt")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-customer-prompt")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-save")).toBeVisible();
  await expect(page.getByTestId("ai-knowledge-refresh")).toBeVisible();
  await expect(page.getByTestId("ai-knowledge-ingest-docs")).toBeVisible();
  await expect(page.getByTestId("ai-knowledge-ingest-datasets")).toBeVisible();
  await expect(page.getByTestId("ai-knowledge-index")).toBeVisible();
  await expect(page.getByTestId("ai-knowledge-curated-save")).toBeVisible();
});

test("admin can create a curated knowledge entry from AI settings", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai"), {
    waitUntil: "domcontentloaded",
  });

  const title = `Knowledge ${Date.now()}`;

  await page.getByTestId("ai-knowledge-curated-title").fill(title);
  await page
    .getByTestId("ai-knowledge-curated-summary")
    .fill("Regla validada desde admin");
  await page
    .getByTestId("ai-knowledge-curated-content")
    .fill("Siempre confirmar acciones destructivas antes de ejecutar tools.");
  await page.getByTestId("ai-knowledge-curated-tags").fill("regla,operacion");
  await page.getByTestId("ai-knowledge-curated-save").click();

  await expect(page.getByText("Conocimiento curado guardado")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
});

test("admin can reindex approved knowledge for retrieval", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai"), {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("ai-knowledge-index").click();

  await expect(page.getByText("Retrieval reindexado")).toBeVisible({
    timeout: 20_000,
  });
});

test("admin can upload, open, delete and reupload a managed knowledge document", async ({
  page,
  context,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai"), {
    waitUntil: "domcontentloaded",
  });

  const title = `Knowledge Upload ${Date.now()}`;
  const fixturePath = path.resolve(
    process.cwd(),
    "e2e/fixtures/knowledge-source.txt",
  );

  await page.getByTestId("ai-knowledge-upload-title").fill(title);
  await page
    .getByTestId("ai-knowledge-upload-summary")
    .fill("Documento de prueba gestionado desde la UI");
  await page
    .getByTestId("ai-knowledge-upload-tags")
    .fill("qa,documento,gestionado");
  await page
    .locator('[data-testid="ai-runtime-settings-page"] input[type="file"]')
    .setInputFiles(fixturePath);
  await page.getByTestId("ai-knowledge-upload-submit").click();

  await expect(page.getByText("Documento cargado")).toBeVisible({
    timeout: 20_000,
  });

  const documentCard = page
    .locator('[data-testid^="ai-knowledge-document-"]')
    .filter({ hasText: title })
    .first();
  await expect(documentCard).toBeVisible({ timeout: 20_000 });

  const popupPromise = context.waitForEvent("page");
  await documentCard.getByRole("button", { name: "Ver / descargar" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveURL(/\/api\/ai\/knowledge\/documents\/.+\/file/);
  await popup.close();

  await documentCard.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Documento eliminado")).toBeVisible({
    timeout: 20_000,
  });
  await expect(documentCard).toHaveCount(0);

  await page.getByTestId("ai-knowledge-upload-title").fill(title);
  await page
    .locator('[data-testid="ai-runtime-settings-page"] input[type="file"]')
    .setInputFiles(fixturePath);
  await page.getByTestId("ai-knowledge-upload-submit").click();

  await expect(page.getByText("Documento cargado")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page
      .locator('[data-testid^="ai-knowledge-document-"]')
      .filter({ hasText: title })
      .first(),
  ).toBeVisible({ timeout: 20_000 });
});
