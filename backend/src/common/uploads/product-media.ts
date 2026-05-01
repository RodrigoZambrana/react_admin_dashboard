import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { extname, join, resolve } from 'path'
import type { MultipartFile } from '@fastify/multipart'

export type ProductMediaType = 'image' | 'video'
export type ProductMediaStorageProvider = 'local' | 'cloudinary'

export type StoredProductMediaRecord = {
  provider: ProductMediaStorageProvider
  img: string
  publicId: string | null
  version: number
  type: ProductMediaType
  order: number
  alt?: string
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 20 * 1024 * 1024

const IMAGE_MIME_PREFIX = 'image/'
const VIDEO_MIME_PREFIX = 'video/'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
}

const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
}

const sanitizeSegment = (value: string) =>
  value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const collectStreamBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

const resolveExtension = (file: MultipartFile, type: ProductMediaType) => {
  const original =
    (file as any).filename || (file as any).originalname || 'media'
  const originalExt = extname(original).toLowerCase()

  if (originalExt) {
    return originalExt.startsWith('.') ? originalExt : `.${originalExt}`
  }

  if (type === 'image') {
    return IMAGE_EXTENSIONS[file.mimetype] || '.jpg'
  }

  return VIDEO_EXTENSIONS[file.mimetype] || '.mp4'
}

const stripExtension = (value: string, extension: string) => {
  if (!extension) {
    return value
  }
  const lowerValue = value.toLowerCase()
  const lowerExt = extension.toLowerCase()
  return lowerValue.endsWith(lowerExt) ? value.slice(0, value.length - extension.length) : value
}

const sanitizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const resolveMediaRoot = (productSlug: string, type: ProductMediaType) =>
  join(
    resolve(process.env.MEDIA_ROOT?.trim() || join(process.cwd(), 'media')),
    'products',
    sanitizeSlug(productSlug),
    type === 'video' ? 'videos' : 'images',
  )

const isSupportedMime = (mimeType: string, type: ProductMediaType) =>
  type === 'image'
    ? mimeType.startsWith(IMAGE_MIME_PREFIX)
    : mimeType.startsWith(VIDEO_MIME_PREFIX)

const resolveMaxSize = (type: ProductMediaType) =>
  type === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES

export const persistLocalProductMediaFile = async (
  file: MultipartFile,
  input: {
    productSlug: string
    type: ProductMediaType
    order: number
    alt?: string | null
  },
): Promise<StoredProductMediaRecord> => {
  if (!isSupportedMime(file.mimetype, input.type)) {
    throw new BadRequestException({
      message: input.type === 'image'
        ? 'media.validation.invalidImageType'
        : 'media.validation.invalidVideoType',
    })
  }

  const buffer =
    typeof file.toBuffer === 'function'
      ? await file.toBuffer()
      : await collectStreamBuffer(file.file)

  const maxSize = resolveMaxSize(input.type)
  if (buffer.length > maxSize) {
    throw new BadRequestException({
      message: input.type === 'image'
        ? 'media.validation.imageTooLarge'
        : 'media.validation.videoTooLarge',
    })
  }

  const original =
    (file as any).filename || (file as any).originalname || 'media'
  const ext = resolveExtension(file, input.type)
  const baseName = stripExtension(original, ext)
  const safeName = sanitizeSegment(baseName) || 'media'
  const fileName = `${safeName}-${randomUUID()}${ext}`
  const targetDir = resolveMediaRoot(input.productSlug, input.type)

  await mkdir(targetDir, { recursive: true })
  await writeFile(join(targetDir, fileName), buffer)

  const slug = sanitizeSlug(input.productSlug)
  const kindDir = input.type === 'video' ? 'videos' : 'images'
  const publicId = `products/${slug}/${kindDir}/${fileName}`

  return {
    provider: 'local',
    img: `/media/${publicId}`,
    publicId,
    version: 1,
    type: input.type,
    order: input.order,
    alt: input.alt?.trim() || undefined,
  }
}
