import type { FastifyRequest } from 'fastify'

export type ParsedMultipartResult = {
  fields: Record<string, string>
  file?: MultipartFile
}

type MultipartFile = import('@fastify/multipart').MultipartFile

const toStringValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => toStringValue(item)).join(',')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return ''
}

export const parseSingleFileMultipart = async (
  req: FastifyRequest,
): Promise<ParsedMultipartResult> => {
  const result: ParsedMultipartResult = {
    fields: {},
  }

  const hasMultipart =
    typeof req.isMultipart === 'function' ? req.isMultipart() : false

  if (!hasMultipart || typeof req.parts !== 'function') {
    const body = (req.body ?? {}) as Record<string, unknown>
    for (const [key, value] of Object.entries(body)) {
      result.fields[key] = toStringValue(value)
    }
    return result
  }

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (!result.file) {
        result.file = part
      } else {
        part.file.resume()
      }
    } else if (part.type === 'field') {
      result.fields[part.fieldname] = toStringValue(part.value)
    }
  }

  return result
}
