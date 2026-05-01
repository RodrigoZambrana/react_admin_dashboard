export interface StoryItemDto {
  id: string
  storyId: string
  order: number
  type: 'image' | 'video'
  public_id: string
  duration?: number | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}

export interface StorySummaryDto {
  id: string
  slug: string
  title: string
  cover_public_id: string
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface StoryDetailDto extends StorySummaryDto {
  items: StoryItemDto[]
}
