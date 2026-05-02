import { PrismaClient } from '@prisma/client'
import { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { resolveStoryRoot, scanStoryFilesystem, resolveStoryMediaPublicId } from '../src/common/media/stories-sync'
import { loadEnvFromBackendRoot } from './script-safety'

const prisma = new PrismaClient()
const EXCLUDED_STORY_SLUGS = new Set(['proyectos', 'novedades', 'inspiracion'])

type CliOptions = {
  dryRun: boolean
  strict: boolean
}

const parseArgs = (): CliOptions => {
  const args = new Set(process.argv.slice(2))
  return {
    dryRun: args.has('--dry-run'),
    strict: args.has('--strict'),
  }
}

const titleizeSlug = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const normalizeItemId = (storySlug: string, relativePath: string) =>
  `story-item:${storySlug}:${relativePath.replace(/\\/g, '/').replace(/[^a-zA-Z0-9]+/g, '-')}`

async function main() {
  loadEnvFromBackendRoot()
  const options = parseArgs()
  const root = resolveStoryRoot()
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [] as Dirent[])
  const storyFolders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  const existingStories = await prisma.story.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      isActive: true,
      coverPublicId: true,
    },
  })
  const existingBySlug = new Map(existingStories.map((story) => [story.slug, story]))

  const processedSlugs = new Set<string>()

  for (const folderSlug of storyFolders) {
    if (EXCLUDED_STORY_SLUGS.has(folderSlug)) {
      processedSlugs.add(folderSlug)
      continue
    }
    processedSlugs.add(folderSlug)
    const scan = await scanStoryFilesystem(folderSlug)
    if (!scan.exists) {
      console.warn(`[stories] folder missing: ${scan.storyPath}`)
      continue
    }
    if (!scan.files.length) {
      console.warn(`[stories] ${folderSlug}: no supported media found`)
      continue
    }

    const storyId = `story:${scan.storySlug}`
    const title = titleizeSlug(scan.storySlug)
    const coverPublicId = resolveStoryMediaPublicId(scan.storySlug, scan.files[0]?.filename ?? '')

    const itemPayload = scan.files.slice(0, 10).map((file, index) => ({
      id: normalizeItemId(scan.storySlug, file.filename),
      storyId,
      order: index,
      type: file.kind,
      publicId: resolveStoryMediaPublicId(scan.storySlug, file.filename),
      duration: file.kind === 'image' ? 5000 : null,
      ctaLabel: null,
      ctaUrl: null,
    }))

    console.log(`[stories] ${scan.storySlug}: ${scan.files.length} media files`)

    if (options.dryRun) {
      continue
    }

    await prisma.$transaction(async (tx) => {
      await tx.story.upsert({
        where: { slug: scan.storySlug },
        create: {
          id: storyId,
          slug: scan.storySlug,
          title,
          coverPublicId,
          isActive: true,
        },
        update: {
          coverPublicId,
        },
      })

      await tx.storyItem.deleteMany({
        where: { storyId },
      })

      await tx.storyItem.createMany({
        data: itemPayload.map((item) => ({
          ...item,
          duration: item.duration ?? undefined,
        })),
      })
    })
  }

  if (options.strict) {
    const staleStories = existingStories.filter((story) => !processedSlugs.has(story.slug))
    for (const story of staleStories) {
      console.log(`[stories] removing stale story ${story.slug}`)
      if (options.dryRun) {
        continue
      }
      await prisma.story.delete({
        where: { slug: story.slug },
      })
    }
  }
}

main()
  .catch((error) => {
    console.error('[stories] sync failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
