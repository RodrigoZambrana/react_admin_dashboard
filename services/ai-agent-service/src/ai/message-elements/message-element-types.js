const normalizeWhitespace = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

export const MESSAGE_ELEMENT_KINDS = ['text', 'image', 'audio', 'document', 'table']

export const EXTRACTED_ASSET_KIND_MAP = {
  text: 'text',
  pdf: 'document',
  image: 'image',
  audio: 'audio',
  csv: 'table',
  xlsx: 'table',
}

export const isMessageElementKind = (value) =>
  MESSAGE_ELEMENT_KINDS.includes(String(value || ''))

export const mapAssetTypeToMessageElementKind = (assetType) =>
  EXTRACTED_ASSET_KIND_MAP[String(assetType || '').toLowerCase()] || 'document'

export const normalizeMessageElementText = (value) => normalizeWhitespace(value)

export const createTextMessageElement = (text, source = 'message') => {
  const normalized = normalizeMessageElementText(text)
  if (!normalized) {
    return null
  }

  return {
    kind: 'text',
    text: normalized,
    source,
  }
}
