export interface StoryItem {
  id: string;
  storyId: string;
  order: number;
  type: "image" | "video";
  public_id: string;
  duration?: number | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

export interface StorySummary {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  cover_public_id: string;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryDetail extends StorySummary {
  items: StoryItem[];
}
