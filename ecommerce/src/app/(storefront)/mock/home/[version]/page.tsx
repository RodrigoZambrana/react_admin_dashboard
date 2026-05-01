import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MockPageLoader from "@/components/cms/MockPageLoader";
import { getMockCmsEntry } from "@/lib/mock-cms";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ version: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  try {
    const entry = getMockCmsEntry("home", resolvedParams.version);
    return {
      title: `${entry.title} · Mock`,
      description: entry.description,
    };
  } catch {
    return {};
  }
}

export default async function MockHomeVersionPage({ params }: Props) {
  const resolvedParams = await params;
  try {
    return <MockPageLoader collection="home" version={resolvedParams.version} />;
  } catch {
    notFound();
  }
}

