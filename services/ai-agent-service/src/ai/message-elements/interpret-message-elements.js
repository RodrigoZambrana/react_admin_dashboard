import {
  createTextMessageElement,
  mapAssetTypeToMessageElementKind,
  normalizeMessageElementText,
} from './message-element-types.js'

const resolveAttachmentText = (attachment) =>
  normalizeMessageElementText(
    attachment?.textContent ||
      attachment?.transcriptText ||
      attachment?.ocrText ||
      attachment?.rawText ||
      attachment?.metadata?.transcriptText ||
      attachment?.metadata?.ocrText ||
      attachment?.metadata?.rawText ||
      '',
  )

const mapExtractedAssetToElement = (asset, index) => {
  if (!asset || typeof asset !== 'object') {
    return null
  }

  const kind = mapAssetTypeToMessageElementKind(asset.assetType)
  const assetId = asset.fileName || `${asset.assetType || 'asset'}:${index + 1}`
  const normalizedText = normalizeMessageElementText(
    asset.normalizedText || asset.rawText || '',
  )

  switch (kind) {
    case 'text':
      return createTextMessageElement(normalizedText, 'document_text')
    case 'image':
      return {
        kind,
        assetId,
        caption: asset.fileName || null,
        extractedText: normalizedText || null,
      }
    case 'audio':
      return {
        kind,
        assetId,
        transcript: normalizedText || null,
        language: null,
      }
    case 'table': {
      const rows = Array.isArray(asset.structuredRows) ? asset.structuredRows : []
      const firstRow = rows[0] && typeof rows[0] === 'object' ? rows[0] : null
      const columns = firstRow ? Object.keys(firstRow) : []
      return {
        kind,
        assetId,
        columns,
        rows,
      }
    }
    default:
      return {
        kind: 'document',
        assetId,
        title: asset.fileName || null,
        extractedText: normalizedText || null,
        pages: [],
      }
  }
}

const mapAttachmentToElement = (attachment, index) => {
  if (!attachment || typeof attachment !== 'object') {
    return null
  }

  const kind = mapAssetTypeToMessageElementKind(attachment.assetType || attachment.kind)
  const assetId =
    attachment.fileName ||
    attachment.filename ||
    attachment.name ||
    `${kind}:${index + 1}`
  const text = resolveAttachmentText(attachment)

  switch (kind) {
    case 'text':
      return createTextMessageElement(text, 'message')
    case 'image':
      return {
        kind,
        assetId,
        caption: attachment.fileName || attachment.filename || attachment.name || null,
        extractedText: text || null,
      }
    case 'audio':
      return {
        kind,
        assetId,
        transcript: text || null,
        language: null,
      }
    case 'table':
      return {
        kind,
        assetId,
        columns: [],
        rows: [],
      }
    default:
      return {
        kind: 'document',
        assetId,
        title: attachment.fileName || attachment.filename || attachment.name || null,
        extractedText: text || null,
        pages: [],
      }
  }
}

const elementSignature = (element) => {
  if (!element || typeof element !== 'object') {
    return null
  }

  if (element.kind === 'text') {
    return `text:${normalizeMessageElementText(element.text)}`
  }

  return `${element.kind}:${element.assetId || element.title || element.caption || ''}:${normalizeMessageElementText(
    element.extractedText || element.transcript || '',
  )}`
}

export const interpretMessageElements = ({
  text,
  messageElements = [],
  attachments = [],
  extractedAssets = [],
}) => {
  const elements = []
  const seen = new Set()

  const baseTextElement = createTextMessageElement(text, 'message')
  if (baseTextElement) {
    elements.push(baseTextElement)
    seen.add(elementSignature(baseTextElement))
  }

  const prebuiltElements = Array.isArray(messageElements)
    ? messageElements.filter((item) => item && typeof item === 'object')
    : []

  const extractedElements = Array.isArray(extractedAssets)
    ? extractedAssets.map(mapExtractedAssetToElement).filter(Boolean)
    : []

  const fallbackAttachmentElements =
    extractedElements.length === 0 && Array.isArray(attachments)
      ? attachments.map(mapAttachmentToElement).filter(Boolean)
      : []

  for (const element of [...prebuiltElements, ...extractedElements, ...fallbackAttachmentElements]) {
    const signature = elementSignature(element)
    if (!signature || seen.has(signature)) {
      continue
    }
    seen.add(signature)
    elements.push(element)
  }

  return elements
}
