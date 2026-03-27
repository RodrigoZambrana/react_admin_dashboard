import { BadRequestException } from '@nestjs/common'

type AttachmentInput = {
  assetType?: string | null
  fileName?: string | null
  contentType?: string | null
  content?: string | null
  textContent?: string | null
  metadata?: Record<string, unknown> | null
}

const MAX_DATA_URL_LENGTH = 12 * 1024 * 1024

const ASSET_MIME_MAP: Record<string, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  audio: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/wav'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  pdf: ['application/pdf'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  text: ['text/plain', 'text/markdown', 'application/json'],
}

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38]
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]
const WEBP_WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]
const OGG_SIGNATURE = [0x4f, 0x67, 0x67, 0x53]
const WAV_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]
const WAV_WAVE_SIGNATURE = [0x57, 0x41, 0x56, 0x45]
const WEBM_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3]

const matchesSignature = (bytes: Buffer, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value)

const normalizeAssetType = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null

  if (['image', 'photo', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(normalized)) {
    return 'image'
  }
  if (['audio', 'voice', 'mp3', 'mpeg', 'ogg', 'wav', 'webm'].includes(normalized)) {
    return 'audio'
  }
  if (['video', 'mp4', 'mov', 'quicktime'].includes(normalized)) {
    return 'video'
  }
  if (['pdf'].includes(normalized)) return 'pdf'
  if (['csv'].includes(normalized)) return 'csv'
  if (['xlsx', 'xls', 'excel'].includes(normalized)) return 'xlsx'
  if (['docx', 'doc', 'word'].includes(normalized)) return 'docx'
  if (['text', 'txt', 'md', 'json'].includes(normalized)) return 'text'
  return null
}

const isMostlyPrintableText = (bytes: Buffer) => {
  if (bytes.length === 0) return true

  let printableCount = 0
  for (const value of bytes) {
    const isControlWhitespace = value === 9 || value === 10 || value === 13
    const isPrintableAscii = value >= 32 && value <= 126
    const isExtendedUtf8Lead = value >= 194
    if (isControlWhitespace || isPrintableAscii || isExtendedUtf8Lead) {
      printableCount += 1
    }
  }

  return printableCount / bytes.length >= 0.85
}

const sniffBinaryFormat = (assetType: string, bytes: Buffer) => {
  if (bytes.length === 0) {
    return true
  }

  switch (assetType) {
    case 'image':
      return (
        matchesSignature(bytes, PNG_SIGNATURE) ||
        matchesSignature(bytes, JPEG_SIGNATURE) ||
        matchesSignature(bytes, GIF_SIGNATURE) ||
        (matchesSignature(bytes, WEBP_RIFF_SIGNATURE) &&
          matchesSignature(bytes, WEBP_WEBP_SIGNATURE, 8))
      )
    case 'audio':
      return (
        matchesSignature(bytes, OGG_SIGNATURE) ||
        matchesSignature(bytes, WEBM_SIGNATURE) ||
        (matchesSignature(bytes, WAV_RIFF_SIGNATURE) &&
          matchesSignature(bytes, WAV_WAVE_SIGNATURE, 8)) ||
        matchesSignature(bytes, [0x49, 0x44, 0x33]) ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
      )
    case 'video':
      return (
        matchesSignature(bytes, WEBM_SIGNATURE) ||
        (bytes.length > 8 &&
          String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp')
      )
    case 'pdf':
      return matchesSignature(bytes, PDF_SIGNATURE)
    case 'xlsx':
    case 'docx':
      return matchesSignature(bytes, ZIP_SIGNATURE)
    case 'csv':
    case 'text':
      return isMostlyPrintableText(bytes)
    default:
      return false
  }
}

const extractDataUrlMeta = (content: string) => {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(content.trim())
  if (!match) {
    return null
  }
  return {
    mime: match[1].toLowerCase(),
    base64: match[2],
  }
}

const isAllowedMimeForAssetType = (assetType: string, contentType: string | null) => {
  if (!contentType) {
    return true
  }

  const normalized = contentType.trim().toLowerCase()
  return (ASSET_MIME_MAP[assetType] || []).includes(normalized)
}

export const validateConversationAttachment = (
  attachment: AttachmentInput,
): Required<Pick<AttachmentInput, 'metadata'>> &
  Omit<AttachmentInput, 'metadata'> & { assetType: string | null } => {
  const assetType =
    normalizeAssetType(attachment.assetType) ||
    normalizeAssetType(attachment.contentType) ||
    normalizeAssetType(attachment.fileName?.split('.').pop())

  if (!assetType) {
    throw new BadRequestException('conversation.attachmentUnsupportedType')
  }

  const contentType = attachment.contentType?.trim().toLowerCase() || null
  if (!isAllowedMimeForAssetType(assetType, contentType)) {
    throw new BadRequestException('conversation.attachmentContentTypeMismatch')
  }

  const content = attachment.content?.trim() || null
  if (content) {
    if (!content.startsWith('data:')) {
      throw new BadRequestException('conversation.attachmentContentMustBeDataUrl')
    }
    if (content.length > MAX_DATA_URL_LENGTH) {
      throw new BadRequestException('conversation.attachmentTooLarge')
    }

    const dataUrlMeta = extractDataUrlMeta(content)
    if (!dataUrlMeta) {
      throw new BadRequestException('conversation.attachmentInvalidDataUrl')
    }

    if (!isAllowedMimeForAssetType(assetType, dataUrlMeta.mime)) {
      throw new BadRequestException('conversation.attachmentContentTypeMismatch')
    }

    if (contentType && dataUrlMeta.mime !== contentType) {
      throw new BadRequestException('conversation.attachmentContentTypeMismatch')
    }

    const bytes = Buffer.from(dataUrlMeta.base64, 'base64').subarray(0, 32)
    if (!sniffBinaryFormat(assetType, bytes)) {
      throw new BadRequestException('conversation.attachmentContentSignatureMismatch')
    }
  }

  return {
    assetType,
    fileName: attachment.fileName?.trim() || null,
    contentType,
    content,
    textContent: attachment.textContent?.trim() || null,
    metadata:
      attachment.metadata && typeof attachment.metadata === 'object'
        ? attachment.metadata
        : null,
  }
}

export const STOREfrontAttachmentAccept =
  '.png,.jpg,.jpeg,.webp,.gif,.webm,.ogg,.mp3,.wav,.mp4,.mov,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.md,.json,image/png,image/jpeg,image/webp,image/gif,audio/webm,audio/ogg,audio/mpeg,audio/mp3,audio/wav,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/markdown,application/json,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
