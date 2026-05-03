import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isMockTemplateHomesEnabled } from "@/lib/mock-template-runtime";

type Params = Promise<{ template: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!isMockTemplateHomesEnabled()) {
    return { title: "Not found" };
  }

  const { template } = await params;
  try {
    const { getMockTemplateHome } = await import("@/lib/mock-template-homes");
    const entry = getMockTemplateHome(template);
    return {
      title: `${entry.title} - Mock Templates`,
      description: entry.description,
    };
  } catch {
    return { title: "Mock template not found" };
  }
}

export default async function MockTemplateHomePage({ params }: { params: Params }) {
  if (!isMockTemplateHomesEnabled()) {
    notFound();
  }

  const { template } = await params;
  try {
    const { renderMockTemplateHome } = await import("@/lib/mock-template-homes");
    const page = await renderMockTemplateHome(template);
    return <>{page}</>;
  } catch {
    notFound();
  }
}
