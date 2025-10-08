import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'

type MultipartFile = import('@fastify/multipart').MultipartFile

const ALLOWED_LOGO_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const LOGO_MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
}

const UPLOADS_ROOT = join(process.cwd(), 'uploads')
const SHIPPING_LOGO_DIR = join(UPLOADS_ROOT, 'shipping')

const isLocalUploadPath = (value?: string | null) =>
  Boolean(value && value.startsWith('/uploads/'))

const resolveLocalUploadPath = (value: string) => {
  const relative = value.replace(/^\/uploads\//, '')
  return join(UPLOADS_ROOT, relative)
}

export const normalizeShippingLogoPath = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export const persistShippingLogo = async (
  file: MultipartFile,
  previous?: string | null,
): Promise<string> => {
  if (!ALLOWED_LOGO_MIME.has(file.mimetype)) {
    throw new BadRequestException({
      message: 'settings.shippingOptions.invalidImageType',
    })
  }

  const original =
    (file as any).filename || (file as any).originalname || 'shipping-logo'
  const ext =
    extname(original) || LOGO_MIME_EXTENSION[file.mimetype] || '.png'
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`
  const fileName = `${randomUUID()}${safeExt.toLowerCase()}`

  await mkdir(SHIPPING_LOGO_DIR, { recursive: true })

  const buffer =
    typeof file.toBuffer === 'function'
      ? await file.toBuffer()
      : await collectStreamBuffer(file.file)

  await writeFile(join(SHIPPING_LOGO_DIR, fileName), buffer)

  if (previous && isLocalUploadPath(previous)) {
    try {
      await unlink(resolveLocalUploadPath(previous))
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }

  return `/uploads/shipping/${fileName}`
}

export const deleteShippingLogo = async (value?: string | null) => {
  const normalized = normalizeShippingLogoPath(value)
  if (!normalized || !isLocalUploadPath(normalized)) {
    return
  }

  try {
    await unlink(resolveLocalUploadPath(normalized))
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}

const collectStreamBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}
