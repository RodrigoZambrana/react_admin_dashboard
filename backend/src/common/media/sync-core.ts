import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, readFile, stat, unlink } from 'fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'path'
import { buildProductSlug, slugify } from '../../storefront/utils'

export type MediaSyncMode = 'safe' | 'strict'
export type MediaKind = 'image' | 'video'

export type ProductRecord = {
  id: number
  name: string
  productCode: string | null
  slug: string
}

export type ProductMediaRecord = {
  id: number
  img: string
  name: string | null
  alt: string | null
  familyKey: string | null
  publicId: string | null
  version: number
  sortOrder: number
  kind: MediaKind
}

export type MediaScanFile = {
  kind: MediaKind
  sourcePath: string
  relativePath: string
  filename: string
  hash: string
  size: number
}

export type MediaDesiredRecord = {
  productId: number
  kind: MediaKind
  path: string
  order: number
  sourcePath?: string | null
  public_id: string
  name?: string | null
  alt?: string | null
  familyKey?: string | null
  version?: number
}

export type MediaDiffAction = {
  desired: MediaDesiredRecord
  current?: ProductMediaRecord | null
  targetPath: string
  needsCopy: boolean
}

export type MediaDiffResult = {
  create: MediaDiffAction[]
  update: MediaDiffAction[]
  delete: ProductMediaRecord[]
  unchanged: MediaDiffAction[]
  copy: MediaDiffAction[]
  desired: MediaDesiredRecord[]
  current: ProductMediaRecord[]
}

export type MediaSyncPlan = {
  product: ProductRecord
  productPath: string
  files: MediaScanFile[]
  current: ProductMediaRecord[]
  desired: MediaDesiredRecord[]
  diff: MediaDiffResult
}

export type MediaExportManifestItem = {
  public_id: string
  type: MediaKind
  order: number
  path: string
  name?: string | null
  alt?: string | null
  familyKey?: string | null
  version?: number
}

export type MediaExportManifestProduct = {
  id: number
  slug: string
  media: MediaExportManifestItem[]
}

export type MediaExportManifest = {
  generatedAt: string
  products: MediaExportManifestProduct[]
}

const DEFAULT_MEDIA_ROOT = join(process.cwd(), 'media')
const VALID_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const VALID_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v'])

const normalizeSlug = (value: string) => slugify(value).trim()

const cleanRelativePath = (value: string) =>
  value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.')
    .join('/')

const assertSafeSegment = (value: string) => {
  const normalized = normalizeSlug(value)
  if (!normalized || normalized === '.' || normalized === '..') {
    throw new Error(`Invalid slug/path segment: ${value}`)
  }
  return normalized
}

export const resolveMediaRoot = () => resolve((process.env.MEDIA_ROOT || DEFAULT_MEDIA_ROOT).trim())

export const resolveProductPath = (slug: string) => join(resolveMediaRoot(), 'products', assertSafeSegment(slug))

export const validateMediaStructure = async (slug: string) => {
  const productPath = resolveProductPath(slug)
  const imagesPath = join(productPath, 'images')
  const videosPath = join(productPath, 'videos')
  const productExists = existsSync(productPath)
  const imagesExists = existsSync(imagesPath)
  const videosExists = existsSync(videosPath)

  return {
    productPath,
    imagesPath,
    videosPath,
    productExists,
    imagesExists,
    videosExists,
    hasAnyMedia: imagesExists || videosExists,
  }
}

export const resolveSafePath = (root: string, relativePath: string) => {
  const clean = cleanRelativePath(relativePath)
  if (!clean || clean.startsWith('..') || clean.includes('/../')) {
    throw new Error(`Invalid relative path: ${relativePath}`)
  }

  const absolute = resolve(root, clean)
  const normalizedRoot = resolve(root)
  const rootWithSep = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`
  if (absolute !== normalizedRoot && !absolute.startsWith(rootWithSep)) {
    throw new Error(`Path traversal blocked: ${relativePath}`)
  }

  return absolute
}

export const toMediaRelativePath = (value: string) => {
  const normalized = cleanRelativePath(value)
  if (normalized.startsWith('media/')) {
    return normalized.slice('media/'.length)
  }
  if (normalized.startsWith('/media/')) {
    return normalized.replace(/^\/media\//, '')
  }
  if (normalized.startsWith('uploads/')) {
    return normalized.slice('uploads/'.length)
  }
  if (normalized.startsWith('/uploads/')) {
    return normalized.replace(/^\/uploads\//, '')
  }
  return normalized
}

export const resolveMediaAbsolutePath = (value: string, mediaRoot = resolveMediaRoot()) => {
  const relativePath = toMediaRelativePath(value)
  return resolveSafePath(mediaRoot, relativePath)
}

const hashFile = async (filePath: string) => {
  const hash = createHash('sha1')
  const stream = createReadStream(filePath)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

const walkFiles = async (root: string): Promise<string[]> => {
  const result: string[] = []
  const stack = [root]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (entry.isFile()) {
        result.push(fullPath)
      }
    }
  }

  return result
}

const inferMediaKindFromExtension = (value: string): MediaKind | null => {
  const ext = extname(value).toLowerCase()
  if (VALID_IMAGE_EXTENSIONS.has(ext)) {
    return 'image'
  }
  if (VALID_VIDEO_EXTENSIONS.has(ext)) {
    return 'video'
  }
  return null
}

const stripLeadingMediaFolder = (relativePath: string, kind: MediaKind) => {
  const normalized = cleanRelativePath(relativePath)
  const prefix = `${kind === 'video' ? 'videos' : 'images'}/`
  if (normalized.toLowerCase().startsWith(prefix)) {
    return normalized.slice(prefix.length)
  }
  return normalized
}

export const buildCanonicalMediaSlug = (kind: MediaKind, order: number) =>
  `${kind === 'video' ? 'video' : 'imagen'}_${order + 1}`

export const buildCanonicalMediaLabel = (kind: MediaKind, order: number) =>
  buildCanonicalMediaSlug(kind, order)

export const buildMediaFamilyKey = (value?: string | null) => {
  const normalized = normalizeSlug(value ?? '')
  return normalized || 'media'
}

const stripVersionSuffix = (value: string) =>
  value
    .replace(/[\s._-]*(?:v|ver|version)?\d+$/i, '')
    .replace(/[\s._-]*(?:copy|duplicate|dup)$/i, '')
    .trim()

export const deriveMediaFamilyKey = (value?: string | null) => {
  const base = basename(value ?? '').replace(/\.[^.]+$/, '')
  const normalized = normalizeSlug(stripVersionSuffix(base))
  return normalized || buildMediaFamilyKey(value)
}

const assignFamilyVersions = <T extends { familyKey?: string | null; version?: number }>(items: T[]) => {
  const familyCounts = new Map<string, number>()

  return items.map((item) => {
    const familyKey = item.familyKey ?? 'media'
    const nextVersion = (familyCounts.get(familyKey) ?? 0) + 1
    familyCounts.set(familyKey, nextVersion)
    return {
      ...item,
      version: item.version ?? nextVersion,
    } as T
  })
}

export const loadProducts = async (prisma: PrismaClient): Promise<ProductRecord[]> =>
  prisma.product.findMany({
    select: {
      id: true,
      name: true,
      productCode: true,
    },
  }).then((items) =>
    items.map((item) => ({
      ...item,
      slug: buildProductSlug(item.id, item.name, item.productCode ?? undefined),
    })),
  )

export const resolveProduct = (products: ProductRecord[], slug: string) => {
  const normalizedSlug = normalizeSlug(slug)
  return products.find((product) => normalizeSlug(product.slug) === normalizedSlug) ?? null
}

export const scanFilesystem = async (params: {
  productSlug: string
}) => {
  const productPath = resolveProductPath(params.productSlug)
  const files: MediaScanFile[] = []

  if (!existsSync(productPath)) {
    return files
  }

  const scanned = (await walkFiles(productPath)).sort((left, right) => left.localeCompare(right))
  for (const filePath of scanned) {
    const fileKind = inferMediaKindFromExtension(filePath)
    if (!fileKind) {
      continue
    }

    const relativePath = relative(productPath, filePath).replace(/\\/g, '/')
    const stats = await stat(filePath)
    files.push({
      kind: fileKind,
      sourcePath: filePath,
      relativePath,
      filename: basename(filePath),
      hash: await hashFile(filePath),
      size: stats.size,
    })
  }

  return files
}

export const getProductMedia = async (prisma: PrismaClient, productId: number, slug: string) => {
  const rows = await prisma.productImage.findMany({
    where: {
      productId,
      variantId: null,
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      img: true,
      name: true,
      alt: true,
      familyKey: true,
      publicId: true,
      version: true,
      sortOrder: true,
    },
  })

  return rows.map((row) => {
    const kind: MediaKind = row.img.toLowerCase().includes('/videos/') ? 'video' : 'image'
    const fallbackName = basename(row.img).replace(/\.[^.]+$/, '')
    const filename = basename(row.img)
    const publicId =
      row.publicId?.trim() ||
      `products/${assertSafeSegment(slug)}/${kind === 'video' ? 'videos' : 'images'}/${filename}`

    return {
      ...row,
      publicId,
      kind,
      name: row.name ?? fallbackName,
      alt: row.alt ?? fallbackName,
      familyKey: row.familyKey ?? deriveMediaFamilyKey(row.alt ?? row.name ?? row.img),
    } satisfies ProductMediaRecord
  })
}

export const buildDesiredMediaFromFilesystem = (
  product: ProductRecord,
  files: MediaScanFile[],
) =>
  assignFamilyVersions(
    files.map((file, index) => ({
      productId: product.id,
      kind: file.kind,
      path: `/media/products/${assertSafeSegment(product.slug)}/${file.kind === 'video' ? 'videos' : 'images'}/${stripLeadingMediaFolder(
        file.relativePath,
        file.kind,
      )}`,
      order: index,
      sourcePath: file.sourcePath,
      public_id: `products/${assertSafeSegment(product.slug)}/${file.kind === 'video' ? 'videos' : 'images'}/${stripLeadingMediaFolder(
        file.relativePath,
        file.kind,
      )}`,
      name: buildCanonicalMediaLabel(file.kind, index),
      alt: file.filename.replace(/\.[^.]+$/, ''),
      familyKey: deriveMediaFamilyKey(file.filename),
    })) as MediaDesiredRecord[],
  )

export const buildDesiredMediaFromManifest = (params: {
  productId: number
  manifestMedia: MediaExportManifestItem[]
  sourceFilesRoot: string
}) =>
  assignFamilyVersions(
    params.manifestMedia.map((item, index) => {
      const relativeManifestPath = cleanRelativePath(item.path)
      const sourcePath = resolveSafePath(params.sourceFilesRoot, relativeManifestPath)
      return {
        productId: params.productId,
        kind: item.type,
        path: `/media/${relativeManifestPath}`,
        order: item.order ?? index,
        sourcePath,
        public_id: item.public_id,
        name: item.name ?? buildCanonicalMediaLabel(item.type, index),
        alt: item.alt ?? (basename(relativeManifestPath).replace(/\.[^.]+$/, '') || undefined),
        familyKey: item.familyKey ?? deriveMediaFamilyKey(relativeManifestPath),
      } satisfies MediaDesiredRecord
    }),
  )

export const diffMedia = async (params: {
  desired: MediaDesiredRecord[]
  current: ProductMediaRecord[]
  mediaRoot?: string
  mode: MediaSyncMode
}) => {
  const mediaRoot = params.mediaRoot || resolveMediaRoot()
  const currentByPath = new Map(params.current.map((item) => [item.img, item]))
  const desiredPaths = new Set<string>()

  const result: MediaDiffResult = {
    create: [],
    update: [],
    delete: [],
    unchanged: [],
    copy: [],
    desired: params.desired,
    current: params.current,
  }

  for (const desired of params.desired) {
    desiredPaths.add(desired.path)
    const current = currentByPath.get(desired.path) ?? null
    const targetAbsolutePath = resolveMediaAbsolutePath(desired.path, mediaRoot)
    const targetExists = existsSync(targetAbsolutePath)
    let needsCopy = Boolean(desired.sourcePath)

    if (desired.sourcePath && targetExists) {
      const [sourceHash, targetHash] = await Promise.all([
        hashFile(desired.sourcePath),
        hashFile(targetAbsolutePath),
      ])
      needsCopy = sourceHash !== targetHash
    }

    const action: MediaDiffAction = {
      desired,
      current,
      targetPath: desired.path,
      needsCopy,
    }

    if (needsCopy) {
      result.copy.push(action)
    }

    if (!current) {
      result.create.push(action)
      continue
    }

    const changed =
      current.img !== desired.path ||
      current.sortOrder !== desired.order ||
      current.name !== (desired.name ?? null) ||
      current.alt !== (desired.alt ?? null) ||
      current.familyKey !== (desired.familyKey ?? null) ||
      (current.publicId ?? null) !== (desired.public_id ?? null) ||
      current.version !== (desired.version ?? 1)

    if (changed) {
      result.update.push(action)
    } else {
      result.unchanged.push(action)
    }
  }

  const stale = params.current.filter((item) => !desiredPaths.has(item.img))
  if (params.mode === 'strict') {
    result.delete.push(...stale)
  }

  return result
}

export const applyChanges = async (
  prisma: PrismaClient,
  diff: MediaDiffResult,
  options?: {
    mediaRoot?: string
    dryRun?: boolean
    mode?: MediaSyncMode
    removeStaleFiles?: boolean
  },
) => {
  const mediaRoot = options?.mediaRoot || resolveMediaRoot()
  const dryRun = Boolean(options?.dryRun)
  const mode = options?.mode || 'safe'
  const removeStaleFiles = options?.removeStaleFiles ?? true

  const stats = {
    copied: 0,
    created: 0,
    updated: 0,
    deleted: 0,
  }

  for (const entry of diff.copy) {
    if (!entry.desired.sourcePath) continue
    const targetAbsolutePath = resolveMediaAbsolutePath(entry.desired.path, mediaRoot)
    if (!dryRun) {
      await mkdir(dirname(targetAbsolutePath), { recursive: true })
      await copyFile(entry.desired.sourcePath, targetAbsolutePath)
    }
    stats.copied += 1
  }

  for (const entry of diff.create) {
    stats.created += 1
    if (dryRun) continue
    await prisma.productImage.create({
      data: {
        productId: entry.desired.productId,
        variantId: null,
        img: entry.desired.path,
        name: entry.desired.name ?? null,
        alt: entry.desired.alt ?? entry.desired.name ?? null,
        familyKey: entry.desired.familyKey ?? null,
        publicId: entry.desired.public_id,
        version: entry.desired.version ?? 1,
        sortOrder: entry.desired.order,
      },
    })
  }

  for (const entry of diff.update) {
    if (!entry.current) continue
    stats.updated += 1
    if (dryRun) continue
    await prisma.productImage.update({
      where: { id: entry.current.id },
      data: {
        img: entry.desired.path,
        name: entry.desired.name ?? null,
        alt: entry.desired.alt ?? entry.desired.name ?? null,
        familyKey: entry.desired.familyKey ?? null,
        publicId: entry.desired.public_id,
        version: entry.desired.version ?? 1,
        sortOrder: entry.desired.order,
      },
    })
  }

  if (mode === 'strict' && diff.delete.length > 0) {
    stats.deleted += diff.delete.length
    if (!dryRun) {
      await prisma.productImage.deleteMany({
        where: { id: { in: diff.delete.map((item) => item.id) } },
      })
      if (removeStaleFiles) {
        for (const item of diff.delete) {
          const absolute = resolveMediaAbsolutePath(item.img, mediaRoot)
          if (existsSync(absolute)) {
            try {
              await unlink(absolute)
            } catch {
              // best effort
            }
          }
        }
      }
    }
  }

  return stats
}

export const copyMediaFile = async (source: string, target: string, dryRun = false) => {
  if (!dryRun) {
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
  }
}

export const buildExportManifest = (products: Array<{
  id: number
  slug: string
  media: ProductMediaRecord[]
}>) => ({
  generatedAt: new Date().toISOString(),
    products: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      media: product.media.map((item) => ({
        public_id: item.publicId || toMediaRelativePath(item.img),
        type: item.kind,
        order: item.sortOrder,
        path: toMediaRelativePath(item.img),
        name: item.name ?? null,
        alt: item.alt ?? null,
        familyKey: item.familyKey ?? null,
        version: item.version ?? 1,
      })),
    })),
  })
