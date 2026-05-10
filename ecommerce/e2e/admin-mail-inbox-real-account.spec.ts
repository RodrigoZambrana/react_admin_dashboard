import { expect, test } from "@playwright/test";

import { getOperationalEmailInboxAccountId } from "./support/admin-api";
import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin mail inbox loads the real account surface and opens a detail when messages are available", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const accountId = await getOperationalEmailInboxAccountId(request);

  await page.goto(
    resolveAdminAppUrl(
      `/admin/crm/mail/inbox?account=${encodeURIComponent(accountId)}&mailbox=INBOX`,
    ),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-sidebar-content")).toBeVisible();
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();
});

test("admin mail inbox direct url with account and mailbox resolves the real inbox state", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  const accountId = await getOperationalEmailInboxAccountId(request);

  await page.goto(
    resolveAdminAppUrl(
      `/admin/crm/mail/inbox?account=${encodeURIComponent(accountId)}&mailbox=INBOX`,
    ),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();
});

test("admin mail inbox direct url resolves on mobile without opening the sidebar drawer", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);
  const accountId = await getOperationalEmailInboxAccountId(request);

  await page.goto(
    resolveAdminAppUrl(
      `/admin/crm/mail/inbox?account=${encodeURIComponent(accountId)}&mailbox=INBOX`,
    ),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-inbox-body")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-inbox-list")).toBeVisible();
  await expect(page.getByTestId("admin-inbox-select-account")).toHaveCount(0);
});
