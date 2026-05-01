import CmsPageShell from "@/components/cms/CmsPageShell";
import type { CmsRenderablePage } from "@/types/storefront";
import type { MockCmsCollection } from "@/lib/mock-cms";
import { loadMockCmsPage } from "@/lib/mock-cms";

type Props = {
  collection: MockCmsCollection;
  version: string;
};

export default async function MockPageLoader({ collection, version }: Props) {
  const page = await loadMockCmsPage(collection, version);
  return <CmsPageShell page={page as CmsRenderablePage} />;
}

