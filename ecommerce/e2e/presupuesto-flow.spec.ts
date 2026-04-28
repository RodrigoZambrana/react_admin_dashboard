import { expect, test, type Page } from "@playwright/test";

import { storefrontBaseUrl } from "./support/env";

const budgetProduct = {
  id: 321,
  slug: "cortina-venecianas-aluminio",
  name: "Cortina Venecianas en Aluminio",
  productCode: "cortina-venecianas-aluminio",
  img: null,
  description: "Producto de prueba para presupuesto",
  currency: "UYU",
  unitPrice: 2400,
  measurementType: "M2",
  isPublic: true,
  isBudgetCalculable: true,
  calculationStrategy: "M2",
};

const budgetProductAlt = {
  id: 322,
  slug: "cortina-venecianas-madera",
  name: "Cortina Venecianas en Madera",
  productCode: "cortina-venecianas-madera",
  img: null,
  description: "Producto alternativo para presupuesto",
  currency: "UYU",
  unitPrice: 3100,
  measurementType: "M2",
  isPublic: true,
  isBudgetCalculable: true,
  calculationStrategy: "M2",
};

const toSanitizedTestId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

const routeBudgetApis = async (page: Page, products = [budgetProduct, budgetProductAlt]) => {
  await page.route("**/api/budget/products*", async (route) => {
    await route.fulfill({ json: products });
  });

  await page.route("**/api/budget/lead", async (route) => {
    const body = route.request().postDataJSON() as { name?: string; email?: string; phone?: string };
    await route.fulfill({
      json: {
        customerId: 42,
        name: body.name ?? "Rodrigo",
        email: body.email ?? null,
        phone: body.phone ?? null,
        status: "Lead presupuesto",
      },
    });
  });

  await page.route("**/api/budget/calculate", async (route) => {
    const body = route.request().postDataJSON() as { productId: number; width: number; height: number };
    const product = products.find((entry) => entry.id === body.productId) ?? products[0];
    const area = Number((body.width * body.height).toFixed(2));
    const unitPrice = Number(product.unitPrice);
    const totalPrice = Number((unitPrice * area).toFixed(2));

    await route.fulfill({
      json: {
        productId: body.productId,
        width: body.width,
        height: body.height,
        area,
        unitPrice,
        totalPrice,
        currency: product.currency,
        measurementType: "M2",
        strategy: "M2",
        product,
      },
    });
  });

  await page.route("**/api/budget/summary", async (route) => {
    const body = route.request().postDataJSON() as {
      items: Array<{ productId: number; width: number; height: number; qty?: number }>;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      customerNotes?: string;
    };

    const items = body.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId) ?? products[0];
      const qty = Math.max(1, Math.trunc(Number(item.qty ?? 1)));
      const area = Number((item.width * item.height).toFixed(2));
      const unitPrice = Number(product.unitPrice);
      const totalPrice = Number((unitPrice * area).toFixed(2));
      return {
        productId: item.productId,
        width: item.width,
        height: item.height,
        area,
        unitPrice,
        totalPrice,
        currency: product.currency,
        measurementType: "M2",
        strategy: "M2",
        qty,
        lineTotal: Number((totalPrice * qty).toFixed(2)),
        product,
      };
    });

    const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

    await route.fulfill({
      json: {
        currency: items[0]?.currency ?? "UYU",
        subtotal,
        shippingFee: 0,
        grandTotal: subtotal,
        items,
        customer: {
          name: body.customerName ?? null,
          email: body.customerEmail ?? null,
          phone: body.customerPhone ?? null,
          notes: body.customerNotes ?? null,
        },
      },
    });
  });

  await page.route("**/api/budget/add-to-cart", async (route) => {
    const body = route.request().postDataJSON() as {
      items: Array<{ productId: number; width: number; height: number; qty?: number }>;
    };

    const items = body.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId) ?? products[0];
      const qty = Math.max(1, Math.trunc(Number(item.qty ?? 1)));
      const area = Number((item.width * item.height).toFixed(2));
      const unitPrice = Number(product.unitPrice);
      const totalPrice = Number((unitPrice * area).toFixed(2));
      return {
        productId: item.productId,
        width: item.width,
        height: item.height,
        area,
        unitPrice,
        totalPrice,
        currency: product.currency,
        measurementType: "M2",
        strategy: "M2",
        qty,
        product,
      };
    });

    const subtotal = Number(items.reduce((sum, item) => sum + item.totalPrice * item.qty, 0).toFixed(2));

    await route.fulfill({
      json: {
        currency: items[0]?.currency ?? "UYU",
        subtotal,
        items,
      },
    });
  });
};

test("presupuesto calcula y agrega al carrito", async ({ page }) => {
  await routeBudgetApis(page);

  await page.goto(`${storefrontBaseUrl}/presupuesto`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Calculá tu presupuesto")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Elegí una opción" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Cortina Venecianas en Aluminio")).toBeVisible({ timeout: 20_000 });

  await page.locator("input#budget-width").click();
  await page.keyboard.type("120");
  await page.locator("input#budget-height").click();
  await page.keyboard.type("150");
  await page.getByTestId("budget-calculate").click();
  await expect(page.getByTestId("budget-result-card")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Medida: 120 x 150 cm")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("budget-add-to-list").click();
  await expect(page.getByText("Tu producto quedó listo para el carrito.")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /ir al carrito/i }).click();

  const cartLineId = `budget:${budgetProduct.slug}:1.20x1.50:${budgetProduct.currency}`;
  const sanitizedCartLineId = toSanitizedTestId(cartLineId);

  await expect(page.getByTestId(`cart-line-${sanitizedCartLineId}`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(`cart-line-quantity-${sanitizedCartLineId}`)).toHaveText("1");
  await expect(page.getByTestId(`cart-line-decrease-${sanitizedCartLineId}`)).toBeDisabled();
});

test("presupuesto muestra validación inmediata en medidas", async ({ page }) => {
  await routeBudgetApis(page);

  await page.goto(`${storefrontBaseUrl}/presupuesto`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  await page.locator("input#budget-width").fill("");
  await page.locator("input#budget-height").fill("");
  await page.getByTestId("budget-calculate").click();
  await expect(page.getByText("Ingresá el ancho en cm.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ingresá el alto en cm.")).toBeVisible({ timeout: 20_000 });

  await page.locator("input#budget-width").click();
  await page.keyboard.type("180");
  await page.locator("input#budget-height").click();
  await page.keyboard.type("200");
  await page.getByTestId("budget-calculate").click();
  await expect(page.getByTestId("budget-result-card").getByText("Precio estimado")).toBeVisible({
    timeout: 20_000,
  });
});
