import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/storefront", () => ({
  StorefrontApi: {
    listProducts: vi.fn(),
    listCmsPages: vi.fn(),
  },
}));

import { StorefrontApi } from "@/lib/api/storefront";
import { buildStorefrontSitemap } from "./sitemap";

const mockedApi = vi.mocked(StorefrontApi);

const config = {
  companyProfile: {
    website: "https://tenant.example.com",
  },
} as any;

describe("seo sitemap", () => {
  beforeEach(() => {
    mockedApi.listProducts.mockReset();
    mockedApi.listCmsPages.mockReset();
  });

  it("includes CMS-driven pages and product URLs", async () => {
    mockedApi.listProducts.mockResolvedValue({
      data: [
        {
          id: 1,
          slug: "cortina-roller",
          name: "Cortina Roller",
          updatedAt: "2026-04-25T00:00:00.000Z",
          price: { amount: 100, currency: "UYU" },
          inventoryStatus: "in-stock",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    } as any);
    mockedApi.listCmsPages.mockResolvedValue([
      { path: "", title: "Inicio", locale: "es", updatedAt: "2026-04-27T00:00:00.000Z" },
      { path: "cortinas-roller", title: "Cortinas Roller", locale: "es", updatedAt: "2026-04-26T00:00:00.000Z" },
    ] as any);

    const sitemap = await buildStorefrontSitemap(config);

    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/product/cortina-roller")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/cortinas-roller")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/search")).toBe(false);
  });

  it("drops CMS pages when persistence no longer returns them", async () => {
    mockedApi.listProducts.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    } as any);
    mockedApi.listCmsPages.mockResolvedValue([] as any);

    const sitemap = await buildStorefrontSitemap(config);

    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/cortinas-roller")).toBe(false);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/")).toBe(true);
  });
});
