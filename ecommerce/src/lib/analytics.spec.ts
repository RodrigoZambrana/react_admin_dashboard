import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackAddToCart, trackPurchase, trackViewItem } from "./analytics";

const createProduct = () =>
  ({
    id: 1,
    slug: "cortina-roller",
    name: "Cortina Roller",
    price: { amount: 1200, currency: "UYU" },
    salePrice: { amount: 900, currency: "USD" },
  }) as any;

describe("analytics helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { dataLayer: [] });
  });

  it("uses the public unit price and currency for product events", () => {
    const product = createProduct();

    trackViewItem(product);
    trackAddToCart(product, 2);

    const dataLayer = (globalThis as any).window.dataLayer as Array<Record<string, unknown>>;
    expect(dataLayer).toHaveLength(2);
    expect(dataLayer[0]).toMatchObject({
      event: "view_item",
      ecommerce: {
        currency: "USD",
        value: 900,
        items: [{ price: 900, currency: "USD", quantity: 1 }],
      },
    });
    expect(dataLayer[1]).toMatchObject({
      event: "add_to_cart",
      ecommerce: {
        currency: "USD",
        value: 1800,
        items: [{ price: 900, currency: "USD", quantity: 2 }],
      },
    });
  });

  it("uses line-item unit price and order total for purchases", () => {
    trackPurchase({
      uuid: "order-123",
      summary: {
        grandTotal: { amount: 1800, currency: "USD" },
      },
      items: [
        {
          productId: 1,
          quantity: 2,
          price: { amount: 900, currency: "USD" },
          total: { amount: 1800, currency: "USD" },
          name: "Cortina Roller",
        },
      ],
    } as any);

    const dataLayer = (globalThis as any).window.dataLayer as Array<Record<string, unknown>>;
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toMatchObject({
      event: "purchase",
      ecommerce: {
        transaction_id: "order-123",
        currency: "USD",
        value: 1800,
        items: [{ price: 900, currency: "USD", quantity: 2 }],
      },
    });
  });
});
