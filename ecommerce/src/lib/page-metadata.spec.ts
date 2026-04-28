import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storefront-config", () => ({
  getStorefrontConfig: vi.fn(),
}));

import { getStorefrontConfig } from "@/lib/storefront-config";
import {
  buildCategoryMetadata,
  buildCmsPageMetadata,
  buildProductMetadata,
  buildStorefrontPageMetadata,
} from "@/lib/page-metadata";

const mockedGetStorefrontConfig = vi.mocked(getStorefrontConfig);

const baseConfig = {
  seo: {
    siteName: "urucortinas",
    defaultTitle: "urucortinas",
    titleTemplate: "%s · urucortinas",
    defaultDescription: "Cortinas a medida con producción nacional y asesoramiento personalizado.",
    shareImage: {
      url: "/assets/images/banners/shop-cover.png",
      alt: "urucortinas",
    },
  },
  companyProfile: {
    website: "https://urucortinas.com.uy",
  },
  integrations: {
    google: {
      searchConsole: {
        verificationToken: "google-verification-token",
      },
    },
  },
} as any;

describe("page metadata helpers", () => {
  beforeEach(() => {
    mockedGetStorefrontConfig.mockReset();
  });

  it("builds reusable SEO metadata from storefront config and route context", async () => {
    mockedGetStorefrontConfig.mockResolvedValue(baseConfig);

    const metadata = await buildStorefrontPageMetadata({
      title: "Ventana corrediza",
      description: "Ventana corrediza de aluminio con vidrio simple.",
      keywords: ["ventana", "aluminio", "ventana", null],
      canonicalPath: "/product/ventana-corrediza",
      image: {
        url: "/assets/images/products/hero.png",
        alt: "Ventana corrediza",
      },
    });

    expect(metadata.metadataBase?.toString()).toBe("https://urucortinas.com.uy/");
    expect(metadata.title).toBe("Ventana corrediza · urucortinas");
    expect(metadata.description).toBe("Ventana corrediza de aluminio con vidrio simple.");
    expect(metadata.keywords).toEqual(["urucortinas", "ecommerce", "storefront", "ventana", "aluminio"]);
    expect(metadata.alternates).toEqual({ canonical: "/product/ventana-corrediza" });
    expect(metadata.verification).toEqual({ google: "google-verification-token" });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      title: "Ventana corrediza · urucortinas",
      description: "Ventana corrediza de aluminio con vidrio simple.",
      siteName: "urucortinas",
      type: "website",
      url: "/product/ventana-corrediza",
      images: [
        {
          url: "https://urucortinas.com.uy/assets/images/products/hero.png",
          alt: "Ventana corrediza",
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Ventana corrediza · urucortinas",
      description: "Ventana corrediza de aluminio con vidrio simple.",
      images: ["https://urucortinas.com.uy/assets/images/products/hero.png"],
    });
  });

  it("falls back structurally when route SEO is missing", async () => {
    mockedGetStorefrontConfig.mockResolvedValue({
      seo: {
        siteName: "urucortinas",
        defaultTitle: "urucortinas",
        titleTemplate: "%s · urucortinas",
        defaultDescription: "Catalogo y experiencia de compra conectados al backend del proyecto.",
        shareImage: {
          url: "/assets/images/banners/shop-cover.png",
          alt: "urucortinas",
        },
      },
      companyProfile: {
        website: "https://store.example.com",
      },
      integrations: {
        google: {
          searchConsole: {
            verificationToken: null,
          },
        },
      },
    } as any);

    const metadata = await buildStorefrontPageMetadata({
      canonicalPath: "/shop",
      noIndex: true,
    });

    expect(metadata.title).toBe("urucortinas");
    expect(metadata.description).toBe("Catalogo y experiencia de compra conectados al backend del proyecto.");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toEqual({ canonical: "/shop" });
    expect(metadata.openGraph).toMatchObject({
      title: "urucortinas",
      description: "Catalogo y experiencia de compra conectados al backend del proyecto.",
      siteName: "urucortinas",
      type: "website",
      url: "/shop",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "urucortinas",
      description: "Catalogo y experiencia de compra conectados al backend del proyecto.",
    });
  });

  it("uses company profile SEO fields as the SaaS tenant source of truth", async () => {
    mockedGetStorefrontConfig.mockResolvedValue({
      seo: {
        siteName: "urucortinas",
        defaultTitle: "urucortinas",
        titleTemplate: "%s · urucortinas",
        defaultDescription: "Fallback description that should be overridden by company profile SEO.",
        shareImage: {
          url: "/assets/images/banners/shop-cover.png",
          alt: "urucortinas",
        },
      },
      companyProfile: {
        website: "https://tenant.example.com",
        seoDescription:
          "Urucortinas - Expertos en instalación, mantenimiento y venta de cortinas Roller, bandas verticales, toldos y cortinas de enrollar en PVC y aluminio.",
        seoAuthor: "Urucortinas",
        seoImageUrl: "/assets/images/company/og.png",
        googleSiteVerification: "tenant-google-site-verification",
      },
      integrations: {
        google: {
          searchConsole: {
            verificationToken: null,
          },
        },
      },
    } as any);

    const metadata = await buildStorefrontPageMetadata({
      canonicalPath: "/",
    });

    expect(metadata.description).toBe(
      "Urucortinas - Expertos en instalación, mantenimiento y venta de cortinas Roller, bandas verticales, toldos y cortinas de enrollar en PVC y aluminio.",
    );
    expect(metadata.authors).toEqual([{ name: "Urucortinas" }]);
    expect(metadata.verification).toEqual({ google: "tenant-google-site-verification" });
    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: "https://tenant.example.com/assets/images/company/og.png",
        },
      ],
    });
  });

  it("builds product metadata from entity fields", async () => {
    mockedGetStorefrontConfig.mockResolvedValue(baseConfig);

    const metadata = await buildProductMetadata(
      {
        name: "Cortina roller",
        slug: "cortina-roller",
        shortDescription: "Cortina roller de tela screen.",
        description: "Descripción larga",
        descriptionHtml: "<p>Descripción larga</p>",
        seoTitle: "Cortina roller | urucortinas",
        seoDescription: "Cortina roller con tela screen y confección a medida.",
        seoImageUrl: "/assets/images/products/roller-og.png",
        thumbnail: { id: "1", url: "/assets/images/products/roller.png" } as any,
        gallery: [],
        tags: ["roller", "screen"],
        categories: [{ id: 1, slug: "hogar", name: "Hogar" }] as any,
        mode: "simple",
      },
      "cortina-roller",
    );

    expect(metadata.title).toBe("Cortina roller | urucortinas");
    expect(metadata.description).toBe("Cortina roller con tela screen y confección a medida.");
    expect(metadata.openGraph).toMatchObject({
      title: "Cortina roller | urucortinas",
      type: "website",
      url: "/product/cortina-roller",
      images: [
        {
          url: "https://urucortinas.com.uy/assets/images/products/roller-og.png",
          alt: "Cortina roller | urucortinas",
        },
      ],
    });
  });

  it("builds category and CMS metadata with entity-specific fallbacks", async () => {
    mockedGetStorefrontConfig.mockResolvedValue(baseConfig);

    const categoryMetadata = await buildCategoryMetadata({
      name: "Cortinas",
      slug: "cortinas",
      description: "Cortinas a medida",
      thumbnail: { id: "1", url: "/assets/images/categories/cortinas.png" } as any,
      seoTitle: "Cortinas a medida",
      seoDescription: "Descubre cortinas a medida para cada ambiente.",
      seoImageUrl: "/assets/images/categories/og-cortinas.png",
    });

    const cmsMetadata = await buildCmsPageMetadata({
      title: "About us",
      path: "about-us",
      summary: "Company story and service overview",
      seo: {
        title: "About us | UruCortinas",
        description: "Learn more about our company and services.",
        imageUrl: "/assets/images/cms/about-hero.png",
      },
    } as any);

    expect(categoryMetadata.title).toBe("Cortinas a medida · urucortinas");
    expect(categoryMetadata.openGraph).toMatchObject({
      title: "Cortinas a medida · urucortinas",
      type: "website",
      url: "/categories/cortinas",
    });
    expect(cmsMetadata.title).toBe("About us | UruCortinas");
    expect(cmsMetadata.openGraph).toMatchObject({
      title: "About us | UruCortinas",
      type: "article",
      url: "/about-us",
      images: [
        {
          url: "https://urucortinas.com.uy/assets/images/cms/about-hero.png",
          alt: "About us | UruCortinas",
        },
      ],
    });
  });
});
