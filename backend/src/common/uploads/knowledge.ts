import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile, readFile } from 'fs/promises'
import { extname, join } from 'path'
import * as mammoth from 'mammoth'
import { convert as htmlToText } from 'html-to-text'

type MultipartFile = import('@fastify/multipart').MultipartFile

type PersistKnowledgeResult = {
  path: string
  mime: string
  size: number
  name: string
  content: string
}

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/octet-stream',
])

const ALLOWED_EXTENSION = new Set(['.docx', '.txt', '.md', '.html', '.htm'])

const UPLOADS_ROOT = join(process.cwd(), 'uploads')
const KNOWLEDGE_ROOT = join(UPLOADS_ROOT, 'knowledge')

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

const normalizeText = (input: string) =>
  input
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 24000)

const extractBufferText = async (buffer: Buffer, ext: string) => {
  const normalizedExt = ext.toLowerCase()
  if (normalizedExt === '.docx') {
    const result = await mammoth.extractRawText({ buffer })
    return normalizeText(result.value)
  }

  const raw = buffer.toString('utf8')
  if (normalizedExt === '.html' || normalizedExt === '.htm') {
    return normalizeText(
      htmlToText(raw, {
        wordwrap: false,
        selectors: [
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
        ],
      }),
    )
  }

  return normalizeText(raw)
}

export const persistKnowledgeSourceFile = async (
  file: MultipartFile,
  previousPath?: string | null,
): Promise<PersistKnowledgeResult> => {
  const original =
    (file as any).filename || (file as any).originalname || 'knowledge-source'
  const ext = (extname(original) || '.txt').toLowerCase()

  if (
    (!ALLOWED_MIME.has(file.mimetype) && !ALLOWED_EXTENSION.has(ext)) ||
    !ALLOWED_EXTENSION.has(ext)
  ) {
    throw new BadRequestException({
      message: 'knowledge.unsupportedFileType',
    })
  }

  const buffer =
    typeof file.toBuffer === 'function'
      ? await file.toBuffer()
      : await collectStreamBuffer(file.file)

  const content = await extractBufferText(buffer, ext)
  if (!content.trim()) {
    throw new BadRequestException({
      message: 'knowledge.emptyFileContent',
    })
  }

  const fileName = `${randomUUID()}${ext}`
  await mkdir(KNOWLEDGE_ROOT, { recursive: true })
  await writeFile(join(KNOWLEDGE_ROOT, fileName), buffer)

  if (previousPath && isLocalUploadPath(previousPath)) {
    try {
      await unlink(resolveLocalUploadPath(previousPath))
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }

  return {
    path: `/uploads/knowledge/${fileName}`,
    mime: file.mimetype || 'application/octet-stream',
    size: buffer.length,
    name: original,
    content,
  }
}

export const deleteKnowledgeSourceFile = async (value?: string | null) => {
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

export const readKnowledgeSourceFile = async (value: string) => {
  const fullPath = resolveLocalUploadPath(value)
  return readFile(fullPath)
}
