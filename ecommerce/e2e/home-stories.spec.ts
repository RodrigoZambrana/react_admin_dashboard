import { expect, test } from "@playwright/test";

test.describe("home stories", () => {
  test("opens, navigates and closes CMS stories without crashing", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });

    await page.goto("/");

    await page.getByTestId("home-stories-rail-next").click();
    await page.getByRole("button", { name: /Asesoramiento antes de comprar/i }).click();

    await expect(page.getByTestId("home-story-viewer")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Asesoramiento antes de comprar/i })).toBeVisible();
    await expect(
      page.getByText(/Una guía simple para definir producto, medidas y nivel de prestación antes de pedir cotización\./i)
    ).toBeVisible();

    await page.getByTestId("home-story-story-next").click();
    await expect(page.getByRole("heading", { name: /Compra segura y acompañada/i })).toBeVisible();
    await expect(page.getByText(/Acompañamiento comercial y seguimiento durante todo el proceso\./i)).toBeVisible();

    await page.getByTestId("home-story-story-prev").click();
    await expect(page.getByRole("heading", { name: /Asesoramiento antes de comprar/i })).toBeVisible();

    await page.getByTestId("home-story-story-next").click();
    await page.getByTestId("home-story-story-next").click();
    await expect(page.getByRole("heading", { name: /Entrega coordinada/i })).toBeVisible();
    await expect(page.getByText(/Planificación simple para entrega o instalación según el producto\./i)).toBeVisible();

    await page.getByTestId("home-story-close").click();

    await expect(page.getByTestId("home-story-viewer")).toHaveCount(0);
  });
});
