import { BadRequestException } from '@nestjs/common'
import { filterXSS, IFilterXSSOptions } from 'xss'

const BLOCKED_PATTERNS: RegExp[] = [
  /('|\")\s*or\s+(\d+|true|false|null)/i,
  /\bUNION\b\s+\bSELECT\b/i,
  /\bDROP\b\s+\bTABLE\b/i,
  /\bTRUNCATE\b\s+\bTABLE\b/i,
  /\bALTER\b\s+\bTABLE\b/i,
  /\bEXEC(UTE)?\b/i,
  /\bINSERT\b\s+\bINTO\b/i,
  /\bDELETE\b\s+\bFROM\b/i,
  /\bUPDATE\b\s+\bSET\b/i,
  /--/,
  /\/\*/,
  /\*\//,
  /<[^>]+>/,
]

const baseXssOptions: IFilterXSSOptions = {
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
}

const plainTextOptions: IFilterXSSOptions = {
  ...baseXssOptions,
  whiteList: {},
}

const richTextOptions: IFilterXSSOptions = {
  ...baseXssOptions,
  whiteList: {
    a: ['href', 'target', 'rel', 'title'],
    abbr: ['title'],
    b: [],
    blockquote: ['class'],
    br: [],
    code: ['class'],
    div: ['class'],
    em: [],
    h1: ['class'],
    h2: ['class'],
    h3: ['class'],
    h4: ['class'],
    h5: ['class'],
    h6: ['class'],
    i: ['class'],
    li: ['class'],
    ol: ['class'],
    p: ['class'],
    pre: ['class'],
    s: [],
    span: ['class'],
    strong: ['class'],
    sub: [],
    sup: [],
    u: [],
    ul: ['class'],
  },
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const sanitizeString = (value: string, path?: string) => {
  const sanitized = filterXSS(value, plainTextOptions).trim()
  const normalized = sanitized.replace(/\s+/g, ' ').toUpperCase()
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new BadRequestException({
      message: 'text.validation.invalidCharacters',
      errors: [{ field: path ?? 'payload', key: 'text.validation.invalidCharacters' }],
    })
  }
  return sanitized
}

export const sanitizeHtml = (value: string, path?: string) => {
  const sanitized = filterXSS(value, richTextOptions).trim()
  const normalized = sanitized
    .replace(/<br\s*\/?>(?=\n|$)/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new BadRequestException({
      message: 'text.validation.invalidCharacters',
      errors: [{ field: path ?? 'payload', key: 'text.validation.invalidCharacters' }],
    })
  }
  return sanitized
}

type Sanitizable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Buffer
  | Date
  | Record<string, unknown>
  | Sanitizable[]

export const sanitizeInput = <T extends Sanitizable>(
  payload: T,
  currentPath = '',
): T => {
  if (payload === null || payload === undefined) {
    return payload
  }

  if (typeof payload === 'string') {
    return sanitizeString(payload, currentPath) as T
  }

  if (Array.isArray(payload)) {
    return payload.map((item, index) =>
      sanitizeInput(item as Sanitizable, `${currentPath}[${index}]`),
    ) as T
  }

  if (isPlainObject(payload)) {
    const result: Record<string, unknown> = {}
    Object.entries(payload).forEach(([key, value]) => {
      const nextPath = currentPath ? `${currentPath}.${key}` : key
      result[key] = sanitizeInput(value as Sanitizable, nextPath)
    })
    return result as T
  }

  return payload
}

export const sanitizeRichText = (value: string, path?: string) => sanitizeHtml(value, path)
