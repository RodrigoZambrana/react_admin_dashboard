import { expect, test } from "@playwright/test";

test("contact page exposes sales and support channels", async ({ page }) => {
  await page.goto("http://localhost:3000/contact", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /contact/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /sales and quotes|ventas y presupuestos/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /customer support|atención al cliente/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/email|correo/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/phone|teléfono/i).first()).toBeVisible({ timeout: 20_000 });
});
