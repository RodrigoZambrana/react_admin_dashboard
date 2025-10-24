import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'

type MultipartFile = import('@fastify/multipart').MultipartFile

type PersistOptions = {
  documentType: 'BUDGET' | 'ORDER'
  previousPath?: string | null
}

type PersistResult = {
  path: string
  mime: string
  size: number
  name: string
}

const ALLOWED_DOCUMENT_MIME = new Set(['application/pdf'])

const UPLOADS_ROOT = join(process.cwd(), 'uploads')
const DOCUMENTS_ROOT = join(UPLOADS_ROOT, 'documents')

const SUBDIRECTORY: Record<'BUDGET' | 'ORDER', string> = {
  BUDGET: 'budgets',
  ORDER: 'orders',
}

const isLocalUploadPath = (value?: string | null) =>
  Boolean(value && value.startsWith('/uploads/'))

const resolveLocalUploadPath = (value: string) => {
  const relative = value.replace(/^\/uploads\//, '')
  return join(UPLOADS_ROOT, relative)
}

const collectStreamBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export const persistSalesDocumentFile = async (
  file: MultipartFile,
  options: PersistOptions,
): Promise<PersistResult> => {
  if (!ALLOWED_DOCUMENT_MIME.has(file.mimetype)) {
    throw new BadRequestException({
      message: 'validation.fieldInvalid',
    })
  }

  const original =
    (file as any).filename || (file as any).originalname || 'document.pdf'
  const ext = extname(original) || '.pdf'
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`
  const fileName = `${randomUUID()}${safeExt.toLowerCase()}`

  const subDir = SUBDIRECTORY[options.documentType]
  const targetDir = join(DOCUMENTS_ROOT, subDir)
  await mkdir(targetDir, { recursive: true })

  const buffer =
    typeof file.toBuffer === 'function'
      ? await file.toBuffer()
      : await collectStreamBuffer(file.file)

  await writeFile(join(targetDir, fileName), buffer)

  if (options.previousPath && isLocalUploadPath(options.previousPath)) {
    try {
      await unlink(resolveLocalUploadPath(options.previousPath))
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }

  return {
    path: `/uploads/documents/${subDir}/${fileName}`,
    mime: file.mimetype,
    size: buffer.length,
    name: original,
  }
}

export const deleteSalesDocumentFile = async (value?: string | null) => {
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
