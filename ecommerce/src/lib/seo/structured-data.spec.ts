import { describe, expect, it } from "vitest";

import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
} from "./structured-data";

const config = {
  seo: {
    siteName: "urucortinas",
    defaultTitle: "urucortinas",
    defaultDescription: "default",
  },
  companyProfile: {
    legalName: "UruCortinas S.A.",
    tradeName: "urucortinas",
    website: "https://urucortinas.com.uy",
    seoImageUrl: "/assets/images/company/og.png",
  },
} as const;

describe("seo structured data", () => {
  it("serializes JSON-LD safely", () => {
    expect(serializeJsonLd({ foo: "</script><script>alert(1)</script>" })).toContain(
      "\\u003c/script\\u003e",
    );
  });

  it("builds organization and website schemas from tenant config", () => {
    expect(buildOrganizationJsonLd(config)).toMatchObject({
      "@type": "Organization",
      name: "urucortinas",
      legalName: "UruCortinas S.A.",
    });
    expect(buildWebSiteJsonLd(config)).toMatchObject({
      "@type": "WebSite",
      name: "urucortinas",
      potentialAction: {
        target: "https://urucortinas.com.uy/shop?search={search_term_string}",
      },
    });
  });

  it("builds product, breadcrumb, and article schemas", () => {
    expect(
      buildProductJsonLd(
        config,
        {
          name: "Cortina Roller",
          slug: "cortina-roller",
          shortDescription: "Cortina a medida",
          description: "Descripción",
          descriptionHtml: "<p>Descripción</p>",
          price: { amount: 1200, currency: "UYU" },
          salePrice: null,
          seoTitle: "Cortina Roller | urucortinas",
          seoDescription: "Cortina roller con tela screen y confección a medida.",
          seoImageUrl: "/assets/images/roller-og.png",
          thumbnail: { id: "1", url: "/assets/images/roller.png", alt: "roller" },
          gallery: [],
          inventoryStatus: "in-stock",
          categories: [{ id: 1, slug: "cortinas", name: "Cortinas" }],
        } as any,
      ),
    ).toMatchObject({
      "@type": "Product",
      url: "https://urucortinas.com.uy/product/cortina-roller",
      image: ["https://urucortinas.com.uy/assets/images/roller-og.png"],
      offers: { priceCurrency: "UYU" },
    });

    expect(buildBreadcrumbJsonLd([{ name: "Home", url: "https://example.com/" }])).toMatchObject({
      "@type": "BreadcrumbList",
    });

    expect(
      buildArticleJsonLd(config, {
        title: "Cortinas Roller",
        summary: "Artículo",
        path: "cortinas-roller",
        seo: { title: "Cortinas Roller", description: "Artículo", imageUrl: null },
        updatedAt: "2026-04-27T00:00:00.000Z",
      } as any),
    ).toMatchObject({
      "@type": "Article",
      url: "https://urucortinas.com.uy/cortinas-roller",
      dateModified: "2026-04-27T00:00:00.000Z",
    });
  });
});
