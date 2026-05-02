import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { basename, extname, join, relative } from 'path'
import { slugify } from '../../storefront/utils'
import { resolveMediaRoot, resolveSafePath } from './sync-core'

export type StoryMediaKind = 'image' | 'video'

export type StoryScanFile = {
  kind: StoryMediaKind
  sourcePath: string
  relativePath: string
  filename: string
  order: number
}

export type StoryScanResult = {
  storySlug: string
  storyPath: string
  files: StoryScanFile[]
  exists: boolean
}

const VALID_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VALID_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.ogv'])

const normalizeSlug = (value: string) =>
  slugify(value)
    .trim()
    .replace(/^-+|-+$/g, '')

const assertSafeSegment = (value: string) => {
  const normalized = normalizeSlug(value)
  if (!normalized || normalized === '.' || normalized === '..') {
    throw new Error(`Invalid slug/path segment: ${value}`)
  }
  return normalized
}

export const resolveStoryRoot = () => join(resolveMediaRoot(), 'stories')

export const resolveStoryPath = (slug: string) => join(resolveStoryRoot(), assertSafeSegment(slug))

const inferKind = (filePath: string): StoryMediaKind | null => {
  const extension = extname(filePath).toLowerCase()
  if (VALID_IMAGE_EXTENSIONS.has(extension)) {
    return 'image'
  }
  if (VALID_VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }
  return null
}

export const scanStoryFilesystem = async (storySlug: string): Promise<StoryScanResult> => {
  const normalizedSlug = assertSafeSegment(storySlug)
  const storyPath = resolveStoryPath(normalizedSlug)
  if (!existsSync(storyPath)) {
    return {
      storySlug: normalizedSlug,
      storyPath,
      files: [],
      exists: false,
    }
  }

  const entries = await readdir(storyPath, { withFileTypes: true })
  const filePaths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(storyPath, entry.name))
    .sort((left, right) => left.localeCompare(right))
  const files: StoryScanFile[] = []
  for (const [index, filePath] of filePaths.entries()) {
    const kind = inferKind(filePath)
    if (!kind) {
      continue
    }

    files.push({
      kind,
      sourcePath: filePath,
      relativePath: relative(storyPath, filePath).replace(/\\/g, '/'),
      filename: basename(filePath),
      order: index,
    })
  }

  return {
    storySlug: normalizedSlug,
    storyPath,
    files,
    exists: true,
  }
}

export const resolveStoryMediaPublicId = (storySlug: string, filename: string) => {
  const normalizedSlug = assertSafeSegment(storySlug)
  const normalizedFilename = filename.replace(/\\/g, '/').replace(/^\/+/, '')
  return `stories/${normalizedSlug}/${normalizedFilename}`
}

export const resolveSafeStoryPath = (relativePath: string) => resolveSafePath(resolveMediaRoot(), `stories/${relativePath}`)
