import { readFile } from "fs/promises";
import path from "path";
import type { CmsRenderablePage } from "@/types/storefront";

export type MockCmsCollection = "home" | "multimedia";

export type MockCmsVersion = "current" | "v1" | "v2" | "v3";

type MockCmsManifestItem = {
  title: string;
  description: string;
  file: string;
};

const MOCK_CMS_MANIFEST: Record<MockCmsCollection, Record<string, MockCmsManifestItem>> = {
  home: {
    current: {
      title: "Home current",
      description: "Baseline visual snapshot of the current home.",
      file: "home.mock.current.json",
    },
    v1: {
      title: "Home v1",
      description: "Modern visual-first home.",
      file: "home.mock.v1.json",
    },
    v2: {
      title: "Home v2",
      description: "Editorial storytelling home.",
      file: "home.mock.v2.json",
    },
    v3: {
      title: "Home v3",
      description: "Reserved for future production candidate.",
      file: "home.mock.v3.json",
    },
  },
  multimedia: {
    current: {
      title: "Multimedia current",
      description: "Baseline multimedia exploration page.",
      file: "multimedia.mock.v1.json",
    },
    v1: {
      title: "Multimedia v1",
      description: "Feed-focused multimedia exploration page.",
      file: "multimedia.mock.v1.json",
    },
    v2: {
      title: "Multimedia v2",
      description: "Profile-style multimedia page with stories and media grid only.",
      file: "multimedia.mock.v2.json",
    },
    v3: {
      title: "Multimedia v3",
      description: "Future production candidate slot.",
      file: "multimedia.mock.v3.json",
    },
  },
};

const MOCK_ROOT = path.join(process.cwd(), "src", "mocks");

const normalizeVersion = (value: string): MockCmsVersion => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "current" || normalized === "v1" || normalized === "v2" || normalized === "v3") {
    return normalized;
  }
  throw new Error(`Unsupported mock version: ${value}`);
};

export const listMockCmsVersions = (collection: MockCmsCollection) =>
  Object.entries(MOCK_CMS_MANIFEST[collection]).map(([version, item]) => ({
    version: version as MockCmsVersion,
    ...item,
  }));

export const getMockCmsEntry = (collection: MockCmsCollection, version: string) => {
  const normalizedVersion = normalizeVersion(version);
  const entry = MOCK_CMS_MANIFEST[collection][normalizedVersion];
  if (!entry) {
    throw new Error(`Unsupported mock CMS entry: ${collection}/${version}`);
  }
  return {
    version: normalizedVersion,
    ...entry,
  };
};

export const getMockCmsPath = (collection: MockCmsCollection, version: string) => {
  const entry = getMockCmsEntry(collection, version);
  return path.join(MOCK_ROOT, collection, entry.file);
};

export async function loadMockCmsPage(
  collection: MockCmsCollection,
  version: string,
): Promise<CmsRenderablePage> {
  const filePath = getMockCmsPath(collection, version);
  const raw = await readFile(filePath, "utf8");
  const page = JSON.parse(raw) as CmsRenderablePage;
  return page;
}
