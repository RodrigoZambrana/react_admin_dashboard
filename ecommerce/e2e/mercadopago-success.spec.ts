import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  createMercadoPagoPreference,
  fetchProductDetail,
  listShippingOptions
} from "./support/storefront-api";
import { buildTestCustomer } from "./support/factories";
import {
  getLatestPaymentForOrder,
  markLatestMercadoPagoIntentApproved,
  waitForLatestOrderByCustomerEmail
} from "./support/db";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "USD");
  });
}

function buildCheckoutSnapshot(params: {
  checkoutToken: string;
  customer: ReturnType<typeof buildTestCustomer>;
  productId: number;
  shippingOptionId: number;
  currency: string;
}) {
  return {
    items: [
      {
        productId: params.productId,
        quantity: 1
      }
    ],
    customer: {
      firstName: params.customer.firstName,
      lastName: params.customer.lastName,
      email: params.customer.email,
      phone: params.customer.phone,
      locale: "es"
    },
    shippingAddress: {
      line1: "Av. Italia 1234",
      line2: "",
      street: "Av. Italia",
      number: "1234",
      corner: "Comercio",
      apartment: "101",
      comments: "",
      city: "Montevideo",
      department: "Montevideo",
      neighborhood: "Aguada",
      state: "Montevideo",
      zip: "11000",
      country: "UY"
    },
    fulfillmentMode: "home_delivery" as const,
    shippingOptionId: params.shippingOptionId,
    notes: "",
    currency: params.currency,
    checkoutToken: params.checkoutToken,
    analytics: {
      sessionId: `mp-success-${params.checkoutToken}`,
      referrer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null
    }
  };
}

test.describe("Mercado Pago success flow", () => {
  test.setTimeout(90_000);

  test("creates, approves and resolves a Mercado Pago checkout from the live storefront stack", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page);

    const customer = buildTestCustomer(Date.now());
    const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const shippingOptions = await listShippingOptions(request);
    expect(shippingOptions.length).toBeGreaterThan(0);
    const shippingOption = shippingOptions[0]!;
    const checkoutToken = randomUUID();
    const checkoutSnapshot = buildCheckoutSnapshot({
      checkoutToken,
      customer,
      productId: product.id,
      shippingOptionId: shippingOption.id,
      currency: product.price?.currency ?? "USD"
    });

    const preference = await createMercadoPagoPreference(request, {
      amount: (product.price?.amount ?? 0) + shippingOption.deliveryFees,
      currency: product.price?.currency ?? "USD",
      description: product.name,
      cartId: `cart-${checkoutToken}`,
      checkoutToken,
      payerEmail: customer.email,
      successUrl: "https://example.com/payment/success",
      failureUrl: "https://example.com/payment/error",
      pendingUrl: "https://example.com/payment/pending",
      checkoutSnapshot
    });

    expect(preference.preferenceId).toBeTruthy();

    const approvedIntent = await markLatestMercadoPagoIntentApproved(checkoutToken);
    expect(approvedIntent.externalPaymentId).toBeTruthy();

    await page.addInitScript(
      ({ checkoutSnapshotState }) => {
        window.sessionStorage.setItem("storefront:checkout:state", JSON.stringify(checkoutSnapshotState));
        window.sessionStorage.setItem(
          `storefront:checkout:order-items:${checkoutSnapshotState.checkoutToken}`,
          JSON.stringify([{ productId: checkoutSnapshotState.items[0].productId, quantity: 1 }])
        );
      },
      {
        checkoutSnapshotState: {
          contact: checkoutSnapshot.customer,
          shippingAddress: checkoutSnapshot.shippingAddress,
          fulfillmentMode: checkoutSnapshot.fulfillmentMode,
          items: checkoutSnapshot.items,
          shippingOption,
          payment: {
            method: "mercadopago",
            paymentIntentId: approvedIntent.id,
            paymentId: approvedIntent.externalPaymentId,
            status: "approved",
            statusDetail: "accredited",
            currency: checkoutSnapshot.currency,
            amount: (product.price?.amount ?? 0) + shippingOption.deliveryFees,
            checkoutSnapshot
          },
          notes: checkoutSnapshot.notes,
          completed: { details: true, payment: true },
          checkoutToken
        }
      }
    );

    await page.goto(
      `/payment/success?method=mercadopago&paymentId=${encodeURIComponent(approvedIntent.externalPaymentId)}&status=approved&detail=accredited`,
      { waitUntil: "domcontentloaded" }
    );

    await expect(
      page.getByRole("heading", { name: /Tu pago fue confirmado|Your payment is confirmed/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Aprobado$/i).first()).toBeVisible({ timeout: 20_000 });

    const order = await waitForLatestOrderByCustomerEmail(customer.email);
    expect(order).not.toBeNull();
    const payment = await getLatestPaymentForOrder(order.uuid);

    expect(order.statusId).toBeDefined();
    expect(payment).not.toBeNull();
    expect(payment?.status?.toLowerCase()).toMatch(/approved|confirmed/);
    expect(payment?.method?.toLowerCase()).toBe("mercadopago");
  });
});
