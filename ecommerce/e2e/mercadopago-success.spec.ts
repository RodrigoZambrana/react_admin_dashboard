import { expect, test, type Page } from "@playwright/test";
import { buildCheckoutOrderItems, type CheckoutOrderItemInput } from "@/lib/checkout/order-items";
import { buildPublishedParametricLineId, buildPublishedParametricSummaryEntries } from "@/lib/storefront/published-parametric";
import type { CartLineItem } from "@/state/cart-context";

import {
  getEmailLogsForOrder,
  getLatestPaymentForOrder,
  getNotificationsForOrder,
  markLatestMercadoPagoIntentApproved,
  waitForLatestOrderByCustomerEmail
} from "./support/db";
import { buildTestCustomer, type TestCustomer } from "./support/factories";
import {
  createMercadoPagoPreference,
  fetchProductDetail,
  listShippingOptions,
  previewCheckout
} from "./support/storefront-api";

const PARAMETRIC_PRODUCT_SLUG = "ventana-corrediza-20-natural-3mm-1800x1000";
const CHECKOUT_STATE_KEY = "storefront:checkout:state";
const ORDER_ITEMS_STORAGE_KEY_PREFIX = "storefront:checkout:order-items:";
const MERCADO_PAGO_CURRENCY = "UYU";
const CART_STORAGE_KEY = "storefront.cart.v1";
const DEFAULT_CHECKOUT_ADDRESS = {
  line1: "Av. Italia 1234",
  line2: "101, Comercio",
  street: "Av. Italia",
  number: "1234",
  corner: "Comercio",
  apartment: "101",
  comments: "",
  city: "Montevideo",
  state: "Montevideo",
  zip: "11000",
  country: "UY"
};

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "USD");
  });
}

type PreparedMercadoPagoFlow = {
  checkoutPayload: {
    customer: {
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      locale: string;
    };
    shippingAddress: typeof DEFAULT_CHECKOUT_ADDRESS;
    items: CheckoutOrderItemInput[];
    notes?: string;
    checkoutToken: string;
    shippingOptionId: number;
    fulfillmentMode: "home_delivery";
    currency: "USD";
  };
  checkoutToken: string;
  cartId: string;
  shippingOption: Awaited<ReturnType<typeof listShippingOptions>>[number];
};

async function prepareMercadoPagoCheckout(
  page: Page,
  customer: TestCustomer,
  request: Parameters<typeof listShippingOptions>[0],
  product: Awaited<ReturnType<typeof fetchProductDetail>>
): Promise<PreparedMercadoPagoFlow> {
  const defaultConfiguration = product.publishedParametricOptions?.defaultConfiguration;
  const defaultVariantKey = product.publishedParametricOptions?.defaultVariantKey;

  if (!defaultConfiguration || !defaultVariantKey || !product.price) {
    throw new Error("Published parametric product does not expose a usable default configuration.");
  }

  const translate = (key: string, options?: { defaultMessage?: string }) =>
    options?.defaultMessage ?? key;
  const selectionSummary = buildPublishedParametricSummaryEntries(defaultConfiguration, translate, {
    includeMaterial: false
  })
    .map((entry) => `${entry.attribute}: ${entry.value}`)
    .join(" • ");

  const cartState = {
    updatedAt: Date.now(),
    items: [
      {
        quantity: 1,
        product: {
          id: buildPublishedParametricLineId(product.id, defaultVariantKey),
          productId: product.id,
          mode: "parametric",
          variantKey: defaultVariantKey,
          variantLabel: selectionSummary,
          selectionSummary,
          slug: product.slug,
          name: product.name,
          price: product.price,
          salePrice: null,
          inventoryStatus: "in-stock",
          configuration: defaultConfiguration
        }
      }
    ]
  };

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ storageKey, nextCartState }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(nextCartState));
    },
    { storageKey: CART_STORAGE_KEY, nextCartState: cartState }
  );

  if (!cartState.updatedAt || !Array.isArray(cartState.items) || cartState.items.length === 0) {
    throw new Error("Cart state was not persisted after adding the parametric product.");
  }

  const orderItemsData = buildCheckoutOrderItems(cartState.items as CartLineItem[]);
  if (orderItemsData.error || orderItemsData.items.length === 0) {
    throw new Error(orderItemsData.error ?? "Unable to prepare checkout items from cart.");
  }

  const shippingOptions = await listShippingOptions(request);
  const shippingOption = shippingOptions[0];
  if (!shippingOption?.id) {
    throw new Error("No shipping options available for Mercado Pago E2E.");
  }

  const checkoutToken = `e2e-mp-${Date.now()}`;

  return {
    checkoutToken,
    cartId: `cart-${cartState.updatedAt}`,
    shippingOption,
    checkoutPayload: {
      customer: {
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        locale: "es"
      },
      shippingAddress: DEFAULT_CHECKOUT_ADDRESS,
      items: orderItemsData.items,
      checkoutToken,
      shippingOptionId: shippingOption.id,
      fulfillmentMode: "home_delivery",
      currency: "USD"
    }
  };
}

test.describe("mercado pago success handoff", () => {
  test.setTimeout(90_000);

  test("covers preview -> preference -> success -> order detail with immediate notifications suppressed", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page);

    const customer = buildTestCustomer(Date.now() + 1000);
    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);
    const prepared = await prepareMercadoPagoCheckout(page, customer, request, parametric);

    const preview = await previewCheckout(request, prepared.checkoutPayload as any);
    expect(preview.grandTotal.currency).toBe("USD");

    const preference = await createMercadoPagoPreference(request, {
      amount: preview.grandTotal.amount,
      currency: MERCADO_PAGO_CURRENCY,
      description: "Order payment · urucortinas",
      cartId: prepared.cartId,
      checkoutToken: prepared.checkoutToken,
      payerEmail: customer.email,
      successUrl: "/payment/success",
      failureUrl: "/payment/error",
      pendingUrl: "/payment/error",
      checkoutSnapshot: prepared.checkoutPayload as any
    });

    expect(typeof preference.preferenceId).toBe("string");
    expect(preference.preferenceId.length).toBeGreaterThan(0);

    const approvedIntent = await markLatestMercadoPagoIntentApproved(prepared.checkoutToken);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    await page.evaluate(
      ({
        checkoutStateKey,
        orderItemsStorageKeyPrefix,
        checkoutToken,
        contact,
        shippingAddress,
        shippingOption,
        paymentIntentId,
        paymentId,
        amount,
        checkoutSnapshot,
        orderItems
      }) => {
        const state = {
          contact,
          shippingAddress,
          fulfillmentMode: "home_delivery",
          shippingOption,
          payment: {
          method: "mercadopago",
          paymentIntentId,
          paymentId,
          status: "approved",
          statusDetail: "accredited",
          currency: "USD",
          amount,
          checkoutSnapshot,
          updatedAt: new Date().toISOString()
          },
          notes: "",
          completed: {
            details: true,
            payment: true
          },
          lastOrder: null,
          checkoutToken
        };
        window.sessionStorage.setItem(checkoutStateKey, JSON.stringify(state));
        window.sessionStorage.setItem(
          `${orderItemsStorageKeyPrefix}${checkoutToken}`,
          JSON.stringify(orderItems)
        );
      },
      {
        checkoutStateKey: CHECKOUT_STATE_KEY,
        orderItemsStorageKeyPrefix: ORDER_ITEMS_STORAGE_KEY_PREFIX,
        checkoutToken: prepared.checkoutToken,
        contact: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone
        },
        shippingAddress: DEFAULT_CHECKOUT_ADDRESS,
        shippingOption: prepared.shippingOption,
        paymentIntentId: approvedIntent.id,
        paymentId: approvedIntent.externalPaymentId,
        amount: preview.grandTotal.amount,
        checkoutSnapshot: prepared.checkoutPayload,
        orderItems: prepared.checkoutPayload.items
      }
    );

    await page.goto(
      `/payment/success?paymentId=${encodeURIComponent(approvedIntent.externalPaymentId)}&status=approved&detail=accredited`,
      { waitUntil: "domcontentloaded" }
    );

    await expect(
      page.getByText(
        /tu pago fue confirmado|your payment is confirmed|puedes seguir el estado de tu compra desde mis compras/i
      ).first()
    ).toBeVisible();

    const order = await waitForLatestOrderByCustomerEmail(customer.email);
    expect(order.itemCount).toBe(1);
    expect(order.orderCurrency).toBe("USD");
    expect(order.grandTotal).toBe(preview.grandTotal.amount);

    const payment = await getLatestPaymentForOrder(order.uuid);
    expect(payment?.status).toBe("CONFIRMED");
    expect(payment?.currency).toBe("USD");
    expect(payment?.amount).toBe(preview.grandTotal.amount);

    await expect
      .poll(
        async () =>
          (await getNotificationsForOrder(order.uuid)).filter((row) => row.eventType === "ORDER_RECEIVED").length,
        {
          message: `waiting for order received notifications for ${order.uuid}`
        }
      )
      .toBeGreaterThanOrEqual(2);

    const notifications = await getNotificationsForOrder(order.uuid);
    expect(notifications.filter((row) => row.eventType === "ORDER_RECEIVED")).toHaveLength(2);
    expect(notifications.some((row) => row.eventType === "PAYMENT_RECEIVED")).toBeFalsy();
    expect(notifications.some((row) => row.eventType === "ORDER_STATUS_CHANGED")).toBeFalsy();

    await expect
      .poll(
        async () => (await getEmailLogsForOrder(order.uuid)).filter((row) => row.category === "ORDERS").length,
        {
          message: `waiting for order received emails for ${order.uuid}`
        }
      )
      .toBeGreaterThanOrEqual(2);

    const emails = await getEmailLogsForOrder(order.uuid);
    expect(emails.filter((row) => row.category === "ORDERS")).toHaveLength(2);
    expect(emails.some((row) => row.category === "PAYMENTS")).toBeFalsy();
  });
});
