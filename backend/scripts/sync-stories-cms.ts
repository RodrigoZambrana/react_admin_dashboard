import { CmsEntryStatus, CmsPageScope, CmsPageSectionType, CmsPageBlockType } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { resolveMediaRoot } from '../src/common/media/sync-core'

const prisma = new PrismaClient()
const EXCLUDED_STORY_SLUGS = new Set(['proyectos', 'novedades', 'inspiracion'])

const buildPublicMediaUrl = (publicId: string) => `/media/${publicId.replace(/^\/+/, '')}`

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function main() {
  if (EXCLUDED_STORY_SLUGS.size) {
    await prisma.cmsPage.deleteMany({
      where: {
        path: {
          in: [...EXCLUDED_STORY_SLUGS].map((slug) => `stories/${slug}`),
        },
      },
    })

    await prisma.story.deleteMany({
      where: {
        slug: {
          in: [...EXCLUDED_STORY_SLUGS],
        },
      },
    })
  }

  const stories = await prisma.story.findMany({
    include: {
      items: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  for (const story of stories) {
    if (EXCLUDED_STORY_SLUGS.has(story.slug)) {
      continue
    }
    const slug = normalizeSlug(story.slug)
    const pagePath = `stories/${slug}`
    const coverItem = story.items.find((item) => item.publicId) ?? story.items[0] ?? null
    const coverUrl = coverItem?.publicId ? buildPublicMediaUrl(coverItem.publicId) : null

    const page = await prisma.cmsPage.upsert({
      where: { path: pagePath },
      update: {
        title: story.title,
        summary: story.title,
        scope: CmsPageScope.GENERAL_SITE,
        locale: 'es',
        status: CmsEntryStatus.PUBLISHED,
        visible: true,
        seoTitle: `${story.title} · Historias`,
        seoDescription: `Historia editorial de ${story.title}.`,
        seoImageUrl: coverUrl,
        layoutKey: 'story-detail',
        legacySource: 'stories-sync',
      },
      create: {
        path: pagePath,
        title: story.title,
        summary: story.title,
        scope: CmsPageScope.GENERAL_SITE,
        locale: 'es',
        status: CmsEntryStatus.PUBLISHED,
        visible: true,
        seoTitle: `${story.title} · Historias`,
        seoDescription: `Historia editorial de ${story.title}.`,
        seoImageUrl: coverUrl,
        layoutKey: 'story-detail',
        legacySource: 'stories-sync',
      },
    })

    await prisma.cmsPageSection.deleteMany({
      where: { pageId: page.id },
    })

    const section = await prisma.cmsPageSection.create({
      data: {
        pageId: page.id,
        type: CmsPageSectionType.STORIES_CAROUSEL,
        key: 'story-items',
        name: story.title,
        sortOrder: 0,
        visible: true,
        settings: {
          autoplay: true,
          showProgressBar: true,
          interval: 5000,
        },
      },
    })

    for (const item of story.items) {
      if (!item.publicId) {
        continue
      }

      await prisma.cmsPageBlock.create({
        data: {
          sectionId: section.id,
          type: CmsPageBlockType.IMAGE,
          key: item.order.toString(),
          name: `${story.title} ${item.order + 1}`,
          sortOrder: item.order,
          visible: true,
          content: {
            title: story.title,
            caption: item.ctaLabel ?? null,
            description: item.ctaUrl ?? null,
            mediaPublicId: item.publicId,
            mediaUrl: buildPublicMediaUrl(item.publicId),
            mediaType: item.type === 'video' ? 'video' : 'image',
            durationSec: item.duration ? Math.max(1, Math.round(item.duration / 1000)) : undefined,
            ctaLabel: item.ctaLabel ?? null,
            ctaUrl: item.ctaUrl ?? null,
            alt: story.title,
          },
        },
      })
    }

    console.log(`[stories-cms] synced ${story.slug} -> ${pagePath}`)
  }

  console.log(`[stories-cms] root media: ${resolveMediaRoot()}`)
}

main()
  .catch((error) => {
    console.error('[stories-cms] sync failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
