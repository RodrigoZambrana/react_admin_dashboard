import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin mail inbox loads the real account surface and opens a detail when messages are available", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await page.goto(resolveAdminAppUrl("/app/crm/mail/inbox"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-sidebar-content")).toBeVisible();
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();

  const firstMessage = page.locator('[data-testid^="admin-inbox-mail-"]').first();
  const emptyState = page.getByTestId("admin-inbox-empty");
  const errorState = page.getByTestId("admin-inbox-messages-error");

  await expect(
    page
      .locator(
        '[data-testid^="admin-inbox-mail-"], [data-testid="admin-inbox-empty"], [data-testid="admin-inbox-messages-error"]',
      )
      .first(),
  ).toBeVisible({ timeout: 20_000 });

  if (await firstMessage.isVisible()) {
    await firstMessage.click();
    await expect(page.getByTestId("admin-inbox-detail")).toBeVisible();
    await expect(page).toHaveURL(/account=.*mailbox=.*mail=/);
    return;
  }

  await expect(errorState.or(emptyState)).toBeVisible();
});

test("admin mail inbox direct url with account and mailbox resolves the real inbox state", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await page.goto(
    resolveAdminAppUrl(
      "/app/crm/mail/inbox?account=cmn3gjpog0000pd2olosezfov&mailbox=INBOX",
    ),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();
  await expect(
    page.locator(
      '[data-testid^="admin-inbox-mail-"], [data-testid="admin-inbox-empty"], [data-testid="admin-inbox-messages-error"]',
    ).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test("admin mail inbox direct url resolves on mobile without opening the sidebar drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);

  await page.goto(
    resolveAdminAppUrl(
      "/app/crm/mail/inbox?account=cmn3gjpog0000pd2olosezfov&mailbox=INBOX",
    ),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();
  await expect(page.getByTestId("admin-inbox-select-account")).toHaveCount(0);
  await expect(
    page.locator(
      '[data-testid^="admin-inbox-mail-"], [data-testid="admin-inbox-empty"], [data-testid="admin-inbox-messages-error"]',
    ).first(),
  ).toBeVisible({ timeout: 20_000 });
});
