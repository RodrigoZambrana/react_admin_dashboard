import { expect, test } from "@playwright/test";
import path from "node:path";

import {
  getLatestKnowledgeSnapshot,
  listKnowledgeCandidates,
  listConversationBundles,
  listNegativeExamples,
  reviewKnowledgeCandidate,
  reviewConversationBundle,
  reviewNegativeExample,
} from "./support/admin-api";
import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { seedKnowledgeConversationMessage } from "./support/db";

const AI_RUNTIME_PATH = "/app/settings/ai/runtime";

async function pollForFirstItem<T>(
  load: () => Promise<T[]>,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const intervalMs = options?.intervalMs ?? 1_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const items = await load();
    if (items.length > 0) {
      return items[0] as T;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for knowledge item");
}

test("admin can open AI home and navigate to runtime settings", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl(AI_RUNTIME_PATH), {
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
});

test("admin can create a curated knowledge entry from knowledge documents", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/documents"), {
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

  await expect(page.getByText("Documento curado guardado")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
});

test("admin can reindex approved knowledge for retrieval from knowledge documents", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/documents"), {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("ai-knowledge-index").click();

  await expect(page.getByText("Reindexado lanzado")).toBeVisible({
    timeout: 20_000,
  });
});

test("admin can open dedicated knowledge candidates and documents screens", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/overview"), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("ai-knowledge-overview-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Overview", level: 4 }),
  ).toBeVisible();

  await page.goto(
    resolveAdminAppUrl("/app/settings/ai/knowledge/manage-articles"),
    {
      waitUntil: "domcontentloaded",
    },
  );
  await expect(
    page.getByTestId("ai-knowledge-manage-articles-page"),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Manage Articles", level: 4 }),
  ).toBeVisible();

  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/candidates"), {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Candidates", level: 4 }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: "Buscar" }).first()).toBeVisible();
  await expect(page.getByText("Detalle del candidato").or(page.getByText("Sin selección"))).toBeVisible();

  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/documents"), {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Documents", level: 4 }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "Carga manual", level: 5 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Subir documento", level: 5 })).toBeVisible();
  await expect(page.getByText("Detalle del documento").or(page.getByText("Sin selección"))).toBeVisible();

  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/raw-events"), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("ai-knowledge-raw-events-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Raw Events", level: 4 }),
  ).toBeVisible();

  await page.goto(
    resolveAdminAppUrl("/app/settings/ai/knowledge/ingestion-runs"),
    {
      waitUntil: "domcontentloaded",
    },
  );
  await expect(
    page.getByTestId("ai-knowledge-ingestion-runs-page"),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Ingestion Runs", level: 4 }),
  ).toBeVisible();

  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/feedback"), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("ai-knowledge-feedback-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Feedback", level: 4 }),
  ).toBeVisible();

  await page.goto(
    resolveAdminAppUrl("/app/settings/ai/knowledge/conversation-bundles"),
    {
      waitUntil: "domcontentloaded",
    },
  );
  await expect(
    page.getByTestId("ai-knowledge-conversation-bundles-page"),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Conversation Bundles", level: 4 }),
  ).toBeVisible();

  await page.goto(
    resolveAdminAppUrl("/app/settings/ai/knowledge/negative-examples"),
    {
      waitUntil: "domcontentloaded",
    },
  );
  await expect(
    page.getByTestId("ai-knowledge-negative-examples-page"),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Knowledge Negative Examples", level: 4 }),
  ).toBeVisible();
});

test("admin can upload, open, delete and reupload a managed knowledge document", async ({
  page,
  context,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/documents"), {
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
    .locator('[data-testid="ai-knowledge-documents-page"] input[type="file"]')
    .setInputFiles(fixturePath);
  await page.getByTestId("ai-knowledge-upload-submit").click();

  await expect(
    page.locator(".notification-title").filter({ hasText: "Documento subido" }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await page.getByPlaceholder("título, resumen o contenido").fill(title);
  await page.getByRole("button", { name: "Buscar" }).first().click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
  await page.getByText(title).first().click();

  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Abrir fuente" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveURL(/\/api\/ai\/knowledge\/documents\/.+\/file/);
  await popup.close();

  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Documento eliminado")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(title).first()).toHaveCount(0);

  await page.getByTestId("ai-knowledge-upload-title").fill(title);
  await page
    .locator('[data-testid="ai-knowledge-documents-page"] input[type="file"]')
    .setInputFiles(fixturePath);
  await page.getByTestId("ai-knowledge-upload-submit").click();

  await expect(
    page.locator(".notification-title").filter({ hasText: "Documento subido" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await page.getByPlaceholder("título, resumen o contenido").fill(title);
  await page.getByRole("button", { name: "Buscar" }).first().click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
});

test("snapshot overview and detail separate pending bundle and negative signals from the active digest", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const pendingSeed = `snapshot pending ${Date.now()}`;
  const approvedSeed = `snapshot approved ${Date.now()}`;

  const pendingConversation = await seedKnowledgeConversationMessage(
    `Snapshot Pending ${pendingSeed}`,
    `Necesito seguimiento de pedido ${pendingSeed}`,
    {
      tenantKey: "urucortinas",
      channel: "WEBCHAT",
      scope: "CUSTOMER_PUBLIC",
      authorType: "CUSTOMER",
    },
  );
  const approvedConversation = await seedKnowledgeConversationMessage(
    `Snapshot Approved ${approvedSeed}`,
    `Necesito seguimiento de pedido ${approvedSeed}`,
    {
      tenantKey: "urucortinas",
      channel: "WEBCHAT",
      scope: "CUSTOMER_PUBLIC",
      authorType: "CUSTOMER",
    },
  );

  expect(pendingConversation.candidateId).toBeTruthy();
  expect(approvedConversation.candidateId).toBeTruthy();

  const [pendingCandidate, approvedCandidate] = await Promise.all([
    pollForFirstItem(() =>
      listKnowledgeCandidates(request, {
        tenantKey: "urucortinas",
        status: "pending",
        search: pendingSeed,
        pageSize: 20,
      }),
    ),
    pollForFirstItem(() =>
      listKnowledgeCandidates(request, {
        tenantKey: "urucortinas",
        status: "pending",
        search: approvedSeed,
        pageSize: 20,
      }),
    ),
  ]);

  expect(pendingCandidate?.id).toBeTruthy();
  expect(approvedCandidate?.id).toBeTruthy();

  await reviewKnowledgeCandidate(request, {
    candidateId: pendingCandidate.id,
    approved: false,
  });
  await reviewKnowledgeCandidate(request, {
    candidateId: approvedCandidate.id,
    approved: false,
  });

  const [pendingBundle, approvedBundle, pendingNegative, approvedNegative] = await Promise.all([
    pollForFirstItem(() =>
      listConversationBundles(request, {
        tenantKey: "urucortinas",
        scope: "customer_public",
        status: "pending",
        search: pendingSeed,
        pageSize: 20,
      }),
    ),
    pollForFirstItem(() =>
      listConversationBundles(request, {
        tenantKey: "urucortinas",
        scope: "customer_public",
        status: "pending",
        search: approvedSeed,
        pageSize: 20,
      }),
    ),
    pollForFirstItem(() =>
      listNegativeExamples(request, {
        tenantKey: "urucortinas",
        scope: "customer_public",
        status: "pending",
        search: pendingSeed,
        pageSize: 20,
      }),
    ),
    pollForFirstItem(() =>
      listNegativeExamples(request, {
        tenantKey: "urucortinas",
        scope: "customer_public",
        status: "pending",
        search: approvedSeed,
        pageSize: 20,
      }),
    ),
  ]);

  expect(pendingBundle?.id).toBeTruthy();
  expect(approvedBundle?.id).toBeTruthy();
  expect(pendingNegative?.id).toBeTruthy();
  expect(approvedNegative?.id).toBeTruthy();

  await reviewConversationBundle(request, {
    bundleId: approvedBundle.id,
    action: "approve",
    summary: `Bundle aprobado ${approvedSeed}`,
  });
  await reviewNegativeExample(request, {
    negativeExampleId: approvedNegative.id,
    action: "approve",
    title: `Guardrail aprobado ${approvedSeed}`,
    summary: `Evitar responder con contenido derivado de ${approvedSeed}`,
    correctedText: `Usar una respuesta verificada en lugar de ${approvedSeed}`,
  });

  const latestSnapshot = await getLatestKnowledgeSnapshot(request, {
    tenantKey: "urucortinas",
    scope: "customer_public",
  });

  await loginAsAdmin(page);
  await page.goto(
    resolveAdminAppUrl("/app/settings/ai/knowledge/snapshots?scope=customer_public"),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("ai-knowledge-snapshots-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("ai-knowledge-snapshot-pending-signals")).toContainText(
    pendingSeed,
  );
  await expect(page.getByTestId("ai-knowledge-snapshot-pending-signals-count")).toContainText(
    /\d+/,
  );

  await page.goto(
    resolveAdminAppUrl(`/app/settings/ai/knowledge/snapshots/${latestSnapshot.id}`),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("ai-knowledge-snapshot-detail-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByTestId("ai-knowledge-snapshot-detail-pending-signals"),
  ).toContainText(pendingSeed);
  await expect(page.getByTestId("ai-knowledge-snapshot-detail-page")).toContainText(
    `Guardrail aprobado ${approvedSeed}`,
  );
  await expect(page.getByTestId("ai-knowledge-snapshot-detail-page")).toContainText(
    approvedSeed,
  );

  await page.goto(
    resolveAdminAppUrl(`/app/settings/ai/knowledge/snapshots/${latestSnapshot.id}/sources`),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("ai-knowledge-snapshot-sources-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("ai-knowledge-snapshot-sources-page")).toContainText(
    `Guardrail aprobado ${approvedSeed}`,
  );
  await expect(page.getByTestId("ai-knowledge-snapshot-sources-page")).toContainText(
    approvedSeed,
  );
});

test("admin can edit a knowledge document from the dedicated documents ABM", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/documents"), {
    waitUntil: "domcontentloaded",
  });

  const baseTitle = `Editable Knowledge ${Date.now()}`;
  const updatedTitle = `${baseTitle} v2`;

  await page.getByTestId("ai-knowledge-curated-title").fill(baseTitle);
  await page
    .getByTestId("ai-knowledge-curated-summary")
    .fill("Documento editable desde knowledge documents");
  await page
    .getByTestId("ai-knowledge-curated-content")
    .fill("Texto base para validar edición real en el ABM dedicado.");
  await page.getByTestId("ai-knowledge-curated-tags").fill("editable,qa");
  await page.getByTestId("ai-knowledge-curated-save").click();

  await expect(page.getByText("Documento curado guardado")).toBeVisible({
    timeout: 20_000,
  });

  await page.goto(resolveAdminAppUrl("/app/settings/ai/knowledge/documents"), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("ai-knowledge-documents-page")).toBeVisible({
    timeout: 20_000,
  });

  await page.getByPlaceholder("título, resumen o contenido").fill(baseTitle);
  await page.getByRole("button", { name: "Buscar" }).first().click();
  await expect(page.getByText(baseTitle).first()).toBeVisible({ timeout: 20_000 });
  await page.getByText(baseTitle).first().click();

  await page.getByTestId("ai-knowledge-document-detail-title").fill(updatedTitle);
  await page
    .getByTestId("ai-knowledge-document-detail-summary")
    .fill("Resumen actualizado desde E2E");
  await page
    .getByTestId("ai-knowledge-document-detail-tags")
    .fill("editable,qa,updated");
  await page
    .getByTestId("ai-knowledge-document-detail-content")
    .fill("Contenido actualizado para validar persistencia de metadata y texto.");
  await page.getByTestId("ai-knowledge-document-save").click();

  await expect(page.getByTestId("ai-knowledge-document-detail-title")).toHaveValue(
    updatedTitle,
  );
  await expect(
    page.getByTestId("ai-knowledge-document-detail-content"),
  ).toHaveValue(/Contenido actualizado/);
});

test("admin can approve a seeded knowledge candidate and preserve the manual knowledge loop", async ({
  request,
}) => {
  test.setTimeout(60_000);

  const uniqueId = Date.now();
  const sourceText = `Necesito saber si ya salió mi pedido ${uniqueId}`;
  const approvedReply = `Perfecto, reviso el estado del pedido ${uniqueId} y te confirmo enseguida.`;

  const seededConversation = await seedKnowledgeConversationMessage(
    `Knowledge Source ${uniqueId}`,
    sourceText,
    {
      tenantKey: "urucortinas",
      channel: "WEBCHAT",
      scope: "CUSTOMER_PUBLIC",
      authorType: "CUSTOMER",
    },
  );

  expect(seededConversation.candidateId).toBeTruthy();

  const pendingCandidate = await pollForFirstItem(() =>
    listKnowledgeCandidates(request, {
      status: "pending",
      search: sourceText,
      pageSize: 25,
      orderBy: "createdAt",
      orderDir: "desc",
    }),
  );

  await reviewKnowledgeCandidate(request, {
    candidateId: pendingCandidate.id,
    approved: true,
    content: approvedReply,
  });

  const approvedCandidate = await pollForFirstItem(() =>
    listKnowledgeCandidates(request, {
      status: "approved",
      search: sourceText,
      pageSize: 25,
      orderBy: "createdAt",
      orderDir: "desc",
    }),
  );

  expect(approvedCandidate.id).toBeTruthy();
  expect(approvedCandidate.approvedResponse).toContain(approvedReply);
});
