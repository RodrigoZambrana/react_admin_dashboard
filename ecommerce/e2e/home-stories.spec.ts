import { expect, test } from "@playwright/test";

test.describe("home stories", () => {
  test("opens, navigates and closes CMS stories without crashing", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });

    await page.goto("/");

    await page.getByTestId("home-stories-rail-next").click();
    await page.getByRole("button", { name: /Aberturas destacadas/i }).click();

    await expect(page.getByTestId("home-story-viewer")).toBeVisible();
    await expect(page.getByText(/Explora aberturas publicadas/i)).toBeVisible();
    await page.getByTestId("home-story-story-next").click();
    await expect(page.getByText(/Compara combinaciones publicadas/i)).toBeVisible();
    await page.getByTestId("home-story-story-prev").click();
    await expect(page.getByText(/Explora aberturas publicadas/i)).toBeVisible();
    await page.getByTestId("home-story-story-next").click();
    await page.getByTestId("home-story-story-next").click();
    await expect(page.getByRole("heading", { name: /Detalles de instalacion/i })).toBeVisible();
    await page.getByTestId("home-story-story-next").click();
    await expect(page.getByText(/Encuentra opciones pensadas para elegir mejor/i)).toBeVisible();

    await page.getByTestId("home-story-close").click();

    await expect(page.getByTestId("home-story-viewer")).toHaveCount(0);
  });
});
