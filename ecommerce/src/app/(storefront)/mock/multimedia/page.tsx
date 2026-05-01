import type { Metadata } from "next";
import MockPageLoader from "@/components/cms/MockPageLoader";
import { getMockCmsEntry } from "@/lib/mock-cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const entry = getMockCmsEntry("multimedia-home", "current");
    return {
      title: `${entry.title} · Mock`,
      description: entry.description,
    };
  } catch {
    return {};
  }
}

export default async function MockMultimediaHomePage() {
  return <MockPageLoader collection="multimedia-home" version="current" />;
}
