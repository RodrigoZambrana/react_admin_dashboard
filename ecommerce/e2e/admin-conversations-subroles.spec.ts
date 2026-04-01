import { expect, test, type Page } from "@playwright/test";

import {
  createAdminInternalSessionForUser,
  createManagedAdminUser,
} from "./support/admin-api";
import { loginAsAdminUser, resolveAdminAppUrl } from "./support/admin-ui";

async function openConversation(page: Page, conversationId: string) {
  await page.goto(resolveAdminAppUrl(`/app/crm/conversations/${conversationId}`), {
    waitUntil: "domcontentloaded",
  });
}

async function openInternalConversation(
  page: Page,
  conversationId: string,
  subject: string,
  message: string,
) {
  await openConversation(page, conversationId);
  await expect(page.getByTestId("admin-conversation-detail-title")).toContainText(
    subject,
    { timeout: 20_000 },
  );
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: message,
    }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: /Agent|Agente IA|Asistente IA/,
    }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

async function openConversationDetails(page: Page) {
  await page.getByTestId("admin-conversation-details-open").click();
}

test.describe.serial("admin internal conversations by subrole", () => {
  test("admin_support keeps appointment flow pending confirmation", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const email = `support.operator.${uniqueId}@example.com`;
    const password = `SupportRole@${uniqueId}`;
    const message = `Agendar cita titulada Visita showroom ${uniqueId} para el 10/01/2030 a las 10:00 en showroom central`;

    await createManagedAdminUser(request, {
      name: "Support",
      lastName: "Operator",
      email,
      password,
      role: "ADMIN",
      capabilityGroups: ["support"],
    });
    const subject = `QA support ${uniqueId}`;
    const conversation = await createAdminInternalSessionForUser(
      request,
      { email, password },
      {
        subject,
        message,
      },
    );

    await loginAsAdminUser(page, { email, password });
    await openInternalConversation(page, conversation.id, subject, message);

    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "Identifiqué una nueva cita para agendar",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "Visita showroom",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "¿Deseas agendar esta cita?",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await openConversationDetails(page);

    await expect(page.getByTestId("admin-conversation-role-current")).toContainText(
      "Soporte",
    );
    await expect(
      page.getByTestId("admin-conversation-blocked-tools-current"),
    ).toContainText("create_appointment");
    await expect(
      page.getByTestId("admin-conversation-executed-tools-current"),
    ).toHaveCount(0);
  });

  test("admin_sales blocks payment status actions outside its policy", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const email = `sales.operator.${uniqueId}@example.com`;
    const password = `SalesRole@${uniqueId}`;
    const message = `Marcar pago 15 como confirmado ${uniqueId}`;

    await createManagedAdminUser(request, {
      name: "Sales",
      lastName: "Operator",
      email,
      password,
      role: "ADMIN",
      capabilityGroups: ["sales"],
    });
    const subject = `QA sales ${uniqueId}`;
    const conversation = await createAdminInternalSessionForUser(
      request,
      { email, password },
      {
        subject,
        message,
      },
    );

    await loginAsAdminUser(page, { email, password });
    await openInternalConversation(page, conversation.id, subject, message);

    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "no está habilitada para tu rol conversacional actual",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await openConversationDetails(page);

    await expect(page.getByTestId("admin-conversation-role-current")).toContainText(
      "Ventas",
    );
    await expect(page.getByText(/Motivo:\s*role_intent_blocked/i)).toBeVisible();
    await expect(
      page.getByTestId("admin-conversation-executed-tools-current"),
    ).toHaveCount(0);
  });

  test("admin_operations can execute aberturas register preparation", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const email = `operations.operator.${uniqueId}@example.com`;
    const password = `OperationsRole@${uniqueId}`;
    const message = `Necesito agregar estas aberturas al sistema ${uniqueId}: Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234`;

    await createManagedAdminUser(request, {
      name: "Operations",
      lastName: "Operator",
      email,
      password,
      role: "ADMIN",
      capabilityGroups: ["operations"],
    });
    const subject = `QA operations ${uniqueId}`;
    const conversation = await createAdminInternalSessionForUser(
      request,
      { email, password },
      {
        subject,
        message,
      },
    );

    await loginAsAdminUser(page, { email, password });
    await openInternalConversation(page, conversation.id, subject, message);

    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "He preparado la alta al sistema",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "Listas para alta",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "USD 234",
      }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid^="admin-conversation-message-"]').filter({
        hasText: "vía operativa habitual",
      }).first(),
    ).toHaveCount(0);

    await openConversationDetails(page);

    await expect(page.getByTestId("admin-conversation-role-current")).toContainText(
      "Operaciones",
    );
    await expect(
      page.getByTestId("admin-conversation-executed-tools-current"),
    ).toContainText("prepare_aberturas_insert");
    await expect(page.getByTestId("admin-conversation-tool-calls")).toContainText(
      "prepare_aberturas_insert",
    );
  });
});
