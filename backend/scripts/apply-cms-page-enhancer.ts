import { Prisma, PrismaClient } from '@prisma/client'
import { CMS_PAGE_ENHANCER_BY_ID, type CmsPageEnhancerSpec } from './cms-page-enhancers'

const prisma = new PrismaClient()

const normalizePath = (value: string) => value.trim().replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()

async function ensureMedia(asset: NonNullable<NonNullable<CmsPageEnhancerSpec['sections'][number]['blocks']>[number]['media']>) {
  const existing = await prisma.cmsMedia.findFirst({
    where: { url: asset.url },
    select: { id: true },
  })

  const data = {
    url: asset.url,
    type: asset.type ?? undefined,
    alt: asset.alt ?? null,
    title: asset.title ?? null,
    source: asset.source ?? 'cms_page_enhancer',
    metadata: asset.metadata === null ? Prisma.JsonNull : (asset.metadata as Prisma.InputJsonValue | undefined),
    isActive: true,
  }

  if (existing) {
    const updated = await prisma.cmsMedia.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.cmsMedia.create({
    data,
    select: { id: true },
  })
  return created.id
}

async function getNextSectionSortOrder(pageId: number) {
  const aggregate = await prisma.cmsPageSection.aggregate({
    where: { pageId },
    _max: { sortOrder: true },
  })

  return (aggregate._max.sortOrder ?? -1) + 1
}

async function upsertSection(
  pageId: number,
  enhancerId: string,
  sectionSpec: CmsPageEnhancerSpec['sections'][number],
) {
  const existingSections = await prisma.cmsPageSection.findMany({
    where: {
      pageId,
      key: sectionSpec.key,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, sortOrder: true },
  })

  const [existing, ...duplicateSections] = existingSections
  if (duplicateSections.length) {
    await prisma.cmsPageSection.deleteMany({
      where: {
        id: { in: duplicateSections.map((section) => section.id) },
      },
    })
  }

  const sortOrder = sectionSpec.sortOrder ?? existing?.sortOrder ?? (await getNextSectionSortOrder(pageId))

  const section = existing
    ? await prisma.cmsPageSection.update({
        where: { id: existing.id },
        data: {
          type: sectionSpec.type,
          key: sectionSpec.key,
          name: sectionSpec.name ?? null,
          sortOrder,
          visible: sectionSpec.visible ?? true,
          settings:
            sectionSpec.settings === null
              ? Prisma.JsonNull
              : (sectionSpec.settings as Prisma.InputJsonValue | undefined),
        },
        select: { id: true },
      })
    : await prisma.cmsPageSection.create({
        data: {
          pageId,
          type: sectionSpec.type,
          key: sectionSpec.key,
          name: sectionSpec.name ?? null,
          sortOrder,
          visible: sectionSpec.visible ?? true,
          settings:
            sectionSpec.settings === null
              ? Prisma.JsonNull
              : (sectionSpec.settings as Prisma.InputJsonValue | undefined),
        },
        select: { id: true },
      })

  if (sectionSpec.blocks) {
    await prisma.cmsPageBlock.deleteMany({
      where: { sectionId: section.id },
    })

    for (const block of sectionSpec.blocks) {
      const mediaId = block.media ? await ensureMedia(block.media) : null
      await prisma.cmsPageBlock.create({
        data: {
          sectionId: section.id,
          type: block.type,
          key: block.key ?? null,
          name: block.name ?? null,
          sortOrder: block.sortOrder ?? 0,
          visible: block.visible ?? true,
          content:
            block.content === null ? Prisma.JsonNull : (block.content as Prisma.InputJsonValue | undefined),
          mediaId,
        },
      })
    }
  }

  console.log(`[${enhancerId}] upserted section ${sectionSpec.key} on page ${pageId}`)
}

async function applyEnhancer(enhancer: CmsPageEnhancerSpec) {
  const page = await prisma.cmsPage.findFirst({
    where: { path: normalizePath(enhancer.pagePath) },
    select: { id: true, path: true },
  })

  if (!page) {
    throw new Error(`CMS page not found for path: ${enhancer.pagePath}`)
  }

  if (enhancer.pagePatch) {
    await prisma.cmsPage.update({
      where: { id: page.id },
      data: enhancer.pagePatch,
    })
  }

  for (const match of enhancer.hideSections ?? []) {
    await prisma.cmsPageSection.updateMany({
      where: {
        pageId: page.id,
        ...(match.key ? { key: match.key } : {}),
        ...(match.type ? { type: match.type } : {}),
        ...(match.name ? { name: match.name } : {}),
      },
      data: { visible: false },
    })
  }

  for (const section of enhancer.sections) {
    await upsertSection(page.id, enhancer.id, section)
  }

  console.log(`[${enhancer.id}] enhanced page ${enhancer.pagePath}`)
}

export async function runCmsPageEnhancerById(enhancerId: string) {
  const enhancer = CMS_PAGE_ENHANCER_BY_ID[enhancerId]
  if (!enhancer) {
    const available = Object.keys(CMS_PAGE_ENHANCER_BY_ID).sort()
    throw new Error(`Unknown CMS page enhancer: ${enhancerId}. Available: ${available.join(', ')}`)
  }

  await applyEnhancer(enhancer)
}

export async function runCmsPageEnhancers(enhancerIds?: string[]) {
  const ids = enhancerIds?.length ? enhancerIds : Object.keys(CMS_PAGE_ENHANCER_BY_ID)

  for (const enhancerId of ids) {
    await runCmsPageEnhancerById(enhancerId)
  }
}

export async function disconnectCmsPageEnhancerRunner() {
  await prisma.$disconnect()
}

function readArgValue(argv: string[], flag: string) {
  const prefix = `${flag}=`
  const withEquals = argv.find((value) => value.startsWith(prefix))
  if (withEquals) return withEquals.slice(prefix.length)
  const index = argv.findIndex((value) => value === flag)
  if (index >= 0) return argv[index + 1] ?? ''
  return ''
}

async function main() {
  const enhancerArg = readArgValue(process.argv.slice(2), '--enhancer')
  const enhancerIds = enhancerArg ? enhancerArg.split(',').map((value) => value.trim()).filter(Boolean) : undefined
  await runCmsPageEnhancers(enhancerIds)
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
    .finally(async () => {
      await disconnectCmsPageEnhancerRunner()
    })
}
