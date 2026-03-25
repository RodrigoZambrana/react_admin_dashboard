import { expect, test } from "@playwright/test";

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
