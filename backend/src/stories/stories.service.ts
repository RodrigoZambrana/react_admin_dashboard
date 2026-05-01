import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { CmsPagesService } from '../cms/cms-pages.service'
import { PrismaService } from '../prisma/prisma.service'
import type { StoryDetailDto, StorySummaryDto } from './stories.types'

const STORIES_CACHE_TTL_MS = 60_000

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const buildActiveWhere = (now: Date): Prisma.StoryWhereInput => ({
  isActive: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ],
})

const mapStorySummary = (story: Prisma.StoryGetPayload<{
  select: {
    id: true
    slug: true
    title: true
    coverPublicId: true
    isActive: true
    startsAt: true
    endsAt: true
    createdAt: true
    updatedAt: true
  }
}>): StorySummaryDto => ({
  id: story.id,
  slug: story.slug,
  title: story.title,
  cover_public_id: story.coverPublicId,
  isActive: story.isActive,
  startsAt: story.startsAt?.toISOString() ?? null,
  endsAt: story.endsAt?.toISOString() ?? null,
  createdAt: story.createdAt.toISOString(),
  updatedAt: story.updatedAt.toISOString(),
})

const STORIES_ROUTE_PREFIX = 'stories/'

const normalizeCmsStorySlug = (path: string) => path.trim().toLowerCase()

const extractCmsMediaPublicId = (input?: string | null) => {
  const value = input?.trim()
  if (!value) {
    return null
  }

  if (value.startsWith('/uploads/')) {
    return value.slice('/uploads/'.length)
  }

  if (value.startsWith('/media/')) {
    return value.slice('/media/'.length)
  }

  try {
    const parsed = new URL(value)
    const uploadMarker = '/upload/'
    const uploadIndex = parsed.pathname.indexOf(uploadMarker)
    if (uploadIndex >= 0) {
      const publicPath = parsed.pathname.slice(uploadIndex + uploadMarker.length)
      return publicPath.split('/').filter(Boolean).join('/')
    }
    return parsed.pathname.replace(/^\//, '')
  } catch {
    return value.replace(/^\//, '')
  }
}

const mapCmsStorySummary = (page: {
  id: number
  path: string
  title: string
  seoImageUrl?: string | null
  updatedAt: Date
  createdAt: Date
  sections: Array<{
    blocks: Array<{
      content?: unknown
      media?: {
        url?: string | null
      } | null
    }>
  }>
}): StorySummaryDto | null => {
  const firstMedia =
    page.sections
      .flatMap((section) => section.blocks)
      .map((block) => {
        const content = (block.content ?? {}) as Record<string, unknown>
        const direct =
          (typeof content.mediaPublicId === 'string' && content.mediaPublicId) ||
          (typeof content.publicId === 'string' && content.publicId) ||
          (typeof content.public_id === 'string' && content.public_id) ||
          (typeof content.mediaUrl === 'string' && content.mediaUrl) ||
          (typeof content.imageUrl === 'string' && content.imageUrl) ||
          (typeof content.videoUrl === 'string' && content.videoUrl) ||
          block.media?.url ||
          null
        return extractCmsMediaPublicId(direct)
      })
      .find((publicId): publicId is string => Boolean(publicId)) ??
    extractCmsMediaPublicId(page.seoImageUrl)

  if (!firstMedia) {
    return null
  }

  const slug = normalizeCmsStorySlug(page.path.slice(STORIES_ROUTE_PREFIX.length))
  return {
    id: String(page.id),
    slug,
    title: page.title,
    cover_public_id: firstMedia,
    isActive: true,
    startsAt: null,
    endsAt: null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  }
}

const mapCmsStoryItem = (
  pageId: number,
  slug: string,
  block: {
    id: number
    sortOrder: number
    content?: unknown
    media?: {
      url?: string | null
      type?: string | null
    } | null
  },
): StoryDetailDto['items'][number] | null => {
  const content = (block.content ?? {}) as Record<string, unknown>
  const publicId =
    extractCmsMediaPublicId(
      (typeof content.mediaPublicId === 'string' && content.mediaPublicId) ||
        (typeof content.publicId === 'string' && content.publicId) ||
        (typeof content.public_id === 'string' && content.public_id) ||
        (typeof content.mediaUrl === 'string' && content.mediaUrl) ||
        (typeof content.imageUrl === 'string' && content.imageUrl) ||
        (typeof content.videoUrl === 'string' && content.videoUrl) ||
        block.media?.url ||
        null,
    ) ?? null

  if (!publicId) {
    return null
  }

  const mediaType =
    (typeof content.mediaType === 'string' && content.mediaType.toLowerCase() === 'video' ? 'video' : null) ||
    (typeof block.media?.type === 'string' && block.media.type.toLowerCase() === 'video' ? 'video' : null) ||
    (publicId.match(/\.(mp4|mov|m4v|webm|ogv)$/i) ? 'video' : 'image') ||
    'image'

  const duration = Number(content.durationSec ?? content.duration)
  const durationMs = Number.isFinite(duration)
    ? duration > 0 && duration < 1000
      ? Math.round(duration * 1000)
      : Math.trunc(duration)
    : null

  return {
    id: `${pageId}:${block.id}`,
    storyId: String(pageId),
    order: block.sortOrder,
    type: mediaType as 'image' | 'video',
    public_id: publicId,
    duration: durationMs,
    ctaLabel:
      (typeof content.ctaLabel === 'string' && content.ctaLabel) ||
      (typeof content.label === 'string' && content.label) ||
      null,
    ctaUrl:
      (typeof content.ctaUrl === 'string' && content.ctaUrl) ||
      (typeof content.link === 'string' && content.link) ||
      (typeof content.href === 'string' && content.href) ||
      null,
  }
}

@Injectable()
export class StoriesService {
  private readonly cache = new Map<string, CacheEntry<unknown>>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly cmsPages: CmsPagesService,
  ) {}

  private readCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key)
      return null
    }
    return entry.value as T
  }

  private writeCache<T>(key: string, value: T, ttlMs: number) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async listStories(): Promise<StorySummaryDto[]> {
    const cacheKey = 'stories:list:active'
    const cached = this.readCache<StorySummaryDto[]>(cacheKey)
    if (cached) {
      return cached
    }

    const cmsPages = await this.cmsPages.listPages({
      locale: 'es',
      status: 'PUBLISHED',
      visible: true,
    })

    const cmsStories = (
      await Promise.all(
        cmsPages
          .filter((page) => page.path.startsWith(STORIES_ROUTE_PREFIX) && !page.path.slice(STORIES_ROUTE_PREFIX.length).includes('/'))
          .map(async (page) => {
            const detail = await this.cmsPages.getPublicPageByPath(page.path, 'es')
            return mapCmsStorySummary(detail)
          }),
      )
    ).filter((story): story is StorySummaryDto => Boolean(story))

    if (cmsStories.length) {
      this.writeCache(cacheKey, cmsStories, STORIES_CACHE_TTL_MS)
      return cmsStories
    }

    const now = new Date()
    const stories = await this.prisma.story.findMany({
      where: buildActiveWhere(now),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        coverPublicId: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const response = stories.map(mapStorySummary)
    this.writeCache(cacheKey, response, STORIES_CACHE_TTL_MS)
    return response
  }

  async getStory(slug: string): Promise<StoryDetailDto | null> {
    const normalizedSlug = slug.trim().toLowerCase()
    if (!normalizedSlug) {
      return null
    }

    const cacheKey = `stories:detail:${normalizedSlug}`
    const cached = this.readCache<StoryDetailDto | null>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const cmsPage = await this.cmsPages.getPublicPageByPath(`stories/${normalizedSlug}`, 'es')
      const items = cmsPage.sections
        .flatMap((section) => section.blocks)
        .map((block) => mapCmsStoryItem(cmsPage.id, normalizedSlug, {
          id: block.id,
          sortOrder: block.sortOrder,
          content: block.content,
          media: block.media ? { url: block.media.url, type: block.media.type } : null,
        }))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((left, right) => left.order - right.order)

      if (items.length) {
        const response: StoryDetailDto = {
          id: String(cmsPage.id),
          slug: normalizedSlug,
          title: cmsPage.title,
          cover_public_id:
            mapCmsStorySummary({
              id: cmsPage.id,
              path: cmsPage.path,
              title: cmsPage.title,
              seoImageUrl: cmsPage.seoImageUrl,
              createdAt: cmsPage.createdAt,
              updatedAt: cmsPage.updatedAt,
              sections: cmsPage.sections,
            })?.cover_public_id ?? '',
          isActive: true,
          startsAt: null,
          endsAt: null,
          createdAt: cmsPage.createdAt.toISOString(),
          updatedAt: cmsPage.updatedAt.toISOString(),
          items,
        }
        this.writeCache(cacheKey, response, STORIES_CACHE_TTL_MS)
        return response
      }
    } catch {
      // Fall back to legacy stories table when CMS pages are not present yet.
    }

    const now = new Date()
    const story = await this.prisma.story.findFirst({
      where: {
        slug: normalizedSlug,
        ...buildActiveWhere(now),
      },
      include: {
        items: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!story) {
      return null
    }

    const response: StoryDetailDto = {
      id: story.id,
      slug: story.slug,
      title: story.title,
      cover_public_id: story.coverPublicId,
      isActive: story.isActive,
      startsAt: story.startsAt?.toISOString() ?? null,
      endsAt: story.endsAt?.toISOString() ?? null,
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
      items: story.items.map((item) => ({
        id: item.id,
        storyId: item.storyId,
        order: item.order,
        type: item.type as 'image' | 'video',
        public_id: item.publicId,
        duration: item.duration ?? null,
        ctaLabel: item.ctaLabel ?? null,
        ctaUrl: item.ctaUrl ?? null,
      })),
    }

    this.writeCache(cacheKey, response, STORIES_CACHE_TTL_MS)
    return response
  }
}
