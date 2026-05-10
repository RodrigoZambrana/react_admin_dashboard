import { expect, test } from "@playwright/test";

import { getOperationalEmailInboxAccountId } from "./support/admin-api";
import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin commercial surfaces render stable controls for order list, cms and inbox", async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await loginAsAdmin(page);

  await page.goto(resolveAdminAppUrl("/admin/sales/order-list"), { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-order-list-tools")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-order-list-search")).toBeVisible();
  await expect(page.getByTestId("admin-order-list-table-wrap")).toBeVisible();

  await page.goto(resolveAdminAppUrl("/admin/cms/content"), { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("cms-content-manager")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("cms-sections-card")).toBeVisible();
  await expect(page.getByTestId("cms-entry-form")).toBeVisible();
  await expect(page.getByTestId("cms-entry-save")).toBeVisible();

  const accountId = await getOperationalEmailInboxAccountId(request);

  await page.goto(
    resolveAdminAppUrl(
      `/admin/crm/mail/inbox?account=${encodeURIComponent(accountId)}&mailbox=INBOX`,
    ),
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-sidebar-content")).toBeVisible();
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();
  await expect(page.getByTestId("admin-inbox-detail")).toBeVisible();

  expect(pageErrors).toEqual([]);
});
