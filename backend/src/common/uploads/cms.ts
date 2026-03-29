import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { CmsMediaType } from '@prisma/client'

type MultipartFile = import('@fastify/multipart').MultipartFile

const UPLOADS_ROOT = join(process.cwd(), 'uploads')
const CMS_MEDIA_ROOT = join(UPLOADS_ROOT, 'cms', 'media')

const collectStreamBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

const isLocalUploadPath = (value?: string | null) =>
  Boolean(value && value.startsWith('/uploads/'))

const resolveLocalUploadPath = (value: string) => {
  const relative = value.replace(/^\/uploads\//, '')
  return join(UPLOADS_ROOT, relative)
}

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const classifyMimeType = (mimeType?: string | null): CmsMediaType => {
  const normalized = (mimeType ?? '').trim().toLowerCase()
  if (normalized.startsWith('image/')) {
    return CmsMediaType.IMAGE
  }
  if (normalized.startsWith('video/')) {
    return CmsMediaType.VIDEO
  }
  if (normalized.startsWith('audio/')) {
    return CmsMediaType.AUDIO
  }
  return CmsMediaType.DOCUMENT
}

export type PersistCmsMediaResult = {
  url: string
  mimeType: string
  sizeBytes: number
  fileName: string
  type: CmsMediaType
}

export const persistCmsMediaFile = async (
  file: MultipartFile,
  previous?: string | null,
): Promise<PersistCmsMediaResult> => {
  const originalName =
    sanitizeFileName((file as any).filename || (file as any).originalname || 'cms-media') ||
    'cms-media'
  const ext = extname(originalName) || ''
  const buffer =
    typeof file.toBuffer === 'function'
      ? await file.toBuffer()
      : await collectStreamBuffer(file.file)

  if (!buffer.length) {
    throw new BadRequestException('cms.media.emptyFile')
  }

  if (buffer.length > 25 * 1024 * 1024) {
    throw new BadRequestException('cms.media.fileTooLarge')
  }

  await mkdir(CMS_MEDIA_ROOT, { recursive: true })
  const fileName = `${randomUUID()}${ext.toLowerCase()}`
  await writeFile(join(CMS_MEDIA_ROOT, fileName), buffer)

  if (previous && isLocalUploadPath(previous)) {
    try {
      await unlink(resolveLocalUploadPath(previous))
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }

  const mimeType = file.mimetype || 'application/octet-stream'
  return {
    url: `/uploads/cms/media/${fileName}`,
    mimeType,
    sizeBytes: buffer.length,
    fileName: originalName,
    type: classifyMimeType(mimeType),
  }
}

export const deleteCmsMediaFile = async (value?: string | null) => {
  if (!value || !isLocalUploadPath(value)) {
    return
  }

  try {
    await unlink(resolveLocalUploadPath(value))
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}
