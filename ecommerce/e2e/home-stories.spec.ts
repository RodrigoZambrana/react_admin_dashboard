import { expect, test, type APIRequestContext } from "@playwright/test";

type StorySummary = {
  id: string;
  slug: string;
  title: string;
};

type StoryDetail = StorySummary & {
  subtitle?: string | null;
  description?: string | null;
  items: Array<{
    id: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
  }>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchStories(request: APIRequestContext): Promise<StorySummary[]> {
  const response = await request.get("http://localhost:8080/api/storefront/stories");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function fetchStoryDetail(request: APIRequestContext, slug: string): Promise<StoryDetail> {
  const response = await request.get(`http://localhost:8080/api/storefront/stories/${encodeURIComponent(slug)}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.describe("home stories", () => {
  test("opens and closes a real story detail page without crashing", async ({ page, request }) => {
    const stories = await fetchStories(request);
    expect(stories.length).toBeGreaterThan(0);

    const story = await fetchStoryDetail(request, stories[0].slug);
    expect(story.items.length).toBeGreaterThan(0);

    await page.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });

    await page.goto(`/stories/${story.slug}`);

    const storyHeading = page.getByRole("heading", {
      level: 1,
      name: new RegExp(escapeRegExp(story.title), "i"),
    });

    await expect(storyHeading).toBeVisible();
    if (story.subtitle) {
      await expect(page.getByText(new RegExp(escapeRegExp(story.subtitle), "i"))).toBeVisible();
    }
    if (story.description) {
      await expect(page.getByText(new RegExp(escapeRegExp(story.description), "i"))).toBeVisible();
    }

    const firstItem = story.items[0];
    if (firstItem.ctaLabel) {
      await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(firstItem.ctaLabel), "i") })).toBeVisible();
    }

    await page.getByRole("button", { name: "✕" }).click();
    await page.waitForURL(/\/stories$/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/stories$/);
  });
});
