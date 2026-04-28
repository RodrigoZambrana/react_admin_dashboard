import { describe, expect, it } from "vitest";

import { buildStorefrontRobots } from "./robots";

describe("seo robots", () => {
  it("builds tenant-aware robots metadata", () => {
    const robots = buildStorefrontRobots({
      companyProfile: {
        website: "https://tenant.example.com",
      },
    } as any);

    expect(robots.sitemap).toEqual(["https://tenant.example.com/sitemap.xml"]);
    expect(robots.rules?.[0]).toMatchObject({
      userAgent: "*",
      disallow: expect.arrayContaining(["/account", "/checkout", "/products", "/search"]),
    });
  });
});
