import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AppLayout from "@/components/layout/layout-1";
import Container from "@component/Container";
import Navbar from "@component/navbar/Navbar";
import StoryViewer from "@/components/stories/StoryViewer";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export const revalidate = 60;

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

const loadStory = async (slug: string) => {
  try {
    return await StorefrontApi.getStory(slug);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await loadStory(slug).catch(() => null);

  if (!story) {
    return buildStorefrontPageMetadata({
      title: "Historia no encontrada",
      canonicalPath: `/stories/${slug}`,
    });
  }

  return buildStorefrontPageMetadata({
    title: story.title,
    description: `Historia multimedia de ${story.title}.`,
    canonicalPath: `/stories/${slug}`,
  });
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await loadStory(slug);

  if (!story) {
    notFound();
  }

  return (
    <AppLayout navbar={<Navbar />}>
      <Container my="2rem">
        <StoryViewer story={story} />
      </Container>
    </AppLayout>
  );
}
