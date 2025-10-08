import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import type { FastifyRequest } from 'fastify'

const ALLOWED_AVATAR_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const AVATAR_MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const UPLOADS_ROOT = join(process.cwd(), 'uploads')
const USER_AVATAR_DIR = join(UPLOADS_ROOT, 'users')

const isLocalUploadPath = (value?: string | null) =>
  Boolean(value && value.startsWith('/uploads/'))

const resolveLocalUploadPath = (value: string) => {
  const relative = value.replace(/^\/uploads\//, '')
  return join(UPLOADS_ROOT, relative)
}

type MultipartFile = import('@fastify/multipart').MultipartFile

export const persistAvatarFile = async (
  file: MultipartFile,
  previous?: string | null,
): Promise<string> => {
  if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
    throw new BadRequestException({
      message: 'account.settings.profile.invalidAvatarType',
    })
  }
  const original =
    (file as any).filename || (file as any).originalname || 'avatar'
  const ext =
    extname(original) || AVATAR_MIME_EXTENSION[file.mimetype] || '.png'
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`
  const fileName = `${randomUUID()}${safeExt.toLowerCase()}`
  await mkdir(USER_AVATAR_DIR, { recursive: true })
  const buffer =
    typeof file.toBuffer === 'function'
      ? await file.toBuffer()
      : await collectStreamBuffer(file.file)
  await writeFile(join(USER_AVATAR_DIR, fileName), buffer)

  if (previous && isLocalUploadPath(previous)) {
    try {
      await unlink(resolveLocalUploadPath(previous))
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }

  return `/uploads/users/${fileName}`
}

export const normalizeAvatarPath = (value?: string | null) =>
  value && value.trim() ? value.trim() : null

const getHeaderValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value

const parseOrigin = (raw?: string | null) => {
  if (!raw) {
    return null
  }
  try {
    const url = new URL(raw)
    return url.origin
  } catch (error) {
    try {
      const url = new URL(raw, 'http://placeholder')
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }
}

const buildRequestOrigin = (req: FastifyRequest) => {
  const originHeader = parseOrigin(
    getHeaderValue(req.headers.origin as string | string[] | undefined),
  )
  if (originHeader) {
    return originHeader
  }

  const refererHeader = parseOrigin(
    getHeaderValue(req.headers.referer as string | string[] | undefined),
  )
  if (refererHeader) {
    return refererHeader
  }

  const forwardedProto = getHeaderValue(
    req.headers['x-forwarded-proto'] as string | string[] | undefined,
  )
  const forwardedHost = getHeaderValue(
    req.headers['x-forwarded-host'] as string | string[] | undefined,
  )
  const forwardedPort = getHeaderValue(
    req.headers['x-forwarded-port'] as string | string[] | undefined,
  )
  const protocol = forwardedProto || req.protocol || 'http'
  const hostHeader =
    forwardedHost || getHeaderValue(req.headers.host as string | string[])

  if (!hostHeader) {
    return null
  }

  if (hostHeader.includes(':') || !forwardedPort) {
    return `${protocol}://${hostHeader}`
  }

  return `${protocol}://${hostHeader}:${forwardedPort}`
}

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value)

export const resolveAvatarPublicUrl = (
  req: FastifyRequest,
  value?: string | null,
) => {
  const normalized = normalizeAvatarPath(value)
  if (!normalized) {
    return ''
  }

  if (isAbsoluteUrl(normalized) || !normalized.startsWith('/uploads/')) {
    return normalized
  }

  const origin = buildRequestOrigin(req)
  if (!origin) {
    return normalized
  }

  return `${origin}${normalized}`
}

const collectStreamBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}
