import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMockTemplateHome, renderMockTemplateHome } from "@/lib/mock-template-homes";

type Params = Promise<{ template: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { template } = await params;
  try {
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
  const { template } = await params;
  try {
    const page = await renderMockTemplateHome(template);
    return <>{page}</>;
  } catch {
    notFound();
  }
}
