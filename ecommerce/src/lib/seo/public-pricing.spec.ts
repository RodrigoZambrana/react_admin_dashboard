import { describe, expect, it } from "vitest";

import { resolvePublicPricing, resolveProductPublicPricing } from "./public-pricing";

describe("public pricing", () => {
  it("resolves product summary pricing with sale price as public value", () => {
    const pricing = resolvePublicPricing({
      currency: "UYU",
      price: { amount: 1200, currency: "UYU" },
      salePrice: { amount: 900, currency: "USD" },
    });

    expect(pricing).toEqual({
      currency: "USD",
      basePrice: { amount: 1200, currency: "UYU" },
      publicPrice: { amount: 900, currency: "USD" },
    });
  });

  it("resolves product model pricing using basePrice and public sale price", () => {
    const pricing = resolvePublicPricing({
      currency: "ARS",
      basePrice: 1500,
      price: 1200,
      salePrice: 900,
    });

    expect(pricing).toEqual({
      currency: "ARS",
      basePrice: { amount: 1500, currency: "ARS" },
      publicPrice: { amount: 900, currency: "ARS" },
    });
  });

  it("falls back to the base price when sale price is missing", () => {
    const pricing = resolveProductPublicPricing({
      price: { amount: 1200, currency: "EUR" },
      salePrice: null,
    } as any);

    expect(pricing).toEqual({
      currency: "EUR",
      basePrice: { amount: 1200, currency: "EUR" },
      publicPrice: { amount: 1200, currency: "EUR" },
    });
  });
});
