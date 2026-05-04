import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/storefront", () => ({
  StorefrontApi: {
    listSeoIndexables: vi.fn(),
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
    mockedApi.listSeoIndexables.mockReset();
    mockedApi.listCmsPages.mockReset();
  });

  it("includes CMS-driven pages and indexable entity URLs", async () => {
    mockedApi.listSeoIndexables.mockResolvedValue([
      {
        entityType: "product",
        entityId: 1,
        slug: "abertura-gala",
        path: "/aberturas/abertura-gala",
        updatedAt: "2026-04-25T00:00:00.000Z",
      },
      {
        entityType: "canonical",
        entityId: 2,
        slug: "monoblock",
        path: "/monoblock",
        updatedAt: "2026-04-26T00:00:00.000Z",
      },
    ] as any);
    mockedApi.listCmsPages.mockResolvedValue([
      { path: "", title: "Inicio", locale: "es", updatedAt: "2026-04-27T00:00:00.000Z" },
      { path: "cortinas-roller", title: "Cortinas Roller", locale: "es", updatedAt: "2026-04-26T00:00:00.000Z" },
    ] as any);

    const sitemap = await buildStorefrontSitemap(config);

    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/aberturas/abertura-gala")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/monoblock")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/cortinas-roller")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/")).toBe(true);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/search")).toBe(false);
  });

  it("drops CMS pages when persistence no longer returns them", async () => {
    mockedApi.listSeoIndexables.mockResolvedValue([] as any);
    mockedApi.listCmsPages.mockResolvedValue([] as any);

    const sitemap = await buildStorefrontSitemap(config);

    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/cortinas-roller")).toBe(false);
    expect(sitemap.some((entry) => entry.url === "https://tenant.example.com/")).toBe(true);
  });
});
