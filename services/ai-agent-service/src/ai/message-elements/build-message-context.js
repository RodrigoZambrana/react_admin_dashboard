import {
  createTextMessageElement,
  normalizeMessageElementText,
} from './message-element-types.js'

const MAX_CONTEXT_TEXT_LENGTH = 6000
const MAX_TABLE_ROWS = 5

const extractElementText = (element) => {
  if (!element || typeof element !== 'object') {
    return null
  }

  if (element.kind === 'text') {
    return normalizeMessageElementText(element.text)
  }

  if (element.kind === 'image') {
    return normalizeMessageElementText(element.extractedText || element.caption || '')
  }

  if (element.kind === 'audio') {
    return normalizeMessageElementText(element.transcript || '')
  }

  if (element.kind === 'document') {
    return normalizeMessageElementText(element.extractedText || element.title || '')
  }

  if (element.kind === 'table') {
    const columns = Array.isArray(element.columns) ? element.columns.filter(Boolean) : []
    const rows = Array.isArray(element.rows) ? element.rows.slice(0, MAX_TABLE_ROWS) : []
    if (!columns.length || !rows.length) {
      return null
    }

    const rowLines = rows
      .map((row) =>
        columns
          .map((column) => {
            const value = row?.[column]
            if (value === null || value === undefined || value === '') {
              return null
            }
            return `${column}: ${String(value)}`
          })
          .filter(Boolean)
          .join(', '),
      )
      .filter(Boolean)

    if (!rowLines.length) {
      return null
    }

    return normalizeMessageElementText(
      [`Tabla con columnas ${columns.join(', ')}`, ...rowLines].join('. '),
    )
  }

  return null
}

const buildElementLabel = (element, index) => {
  if (!element || typeof element !== 'object') {
    return `Elemento ${index + 1}`
  }

  switch (element.kind) {
    case 'image':
      return `Imagen ${index + 1}: ${element.caption || 'sin titulo'}`
    case 'audio':
      return `Audio ${index + 1}: ${element.assetId || 'sin identificador'}`
    case 'document':
      return `Documento ${index + 1}: ${element.title || 'sin titulo'}`
    case 'table':
      return `Tabla ${index + 1}`
    default:
      return `Texto ${index + 1}`
  }
}

export const buildMessageContext = (elements = [], baseText = '') => {
  const baseElement = createTextMessageElement(baseText, 'message')
  const baseNormalizedText = baseElement?.text || ''
  const seenContextTexts = new Set(baseNormalizedText ? [baseNormalizedText] : [])
  const contextSections = []
  const usedElements = []

  for (const [index, element] of elements.entries()) {
    if (!element || typeof element !== 'object' || element.kind === 'text') {
      continue
    }

    const extractedText = extractElementText(element)
    if (!extractedText || seenContextTexts.has(extractedText)) {
      continue
    }

    seenContextTexts.add(extractedText)
    usedElements.push(element)
    contextSections.push(`[${buildElementLabel(element, index)}]\n${extractedText}`)
  }

  const effectiveInput = [baseNormalizedText]
    .concat(
      contextSections.length
        ? ['Contexto extraído desde elementos del mensaje:', ...contextSections]
        : [],
    )
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_CONTEXT_TEXT_LENGTH)
    .trim()

  return {
    baseText: baseNormalizedText,
    elements,
    usedElements,
    usedElementKinds: Array.from(new Set(usedElements.map((item) => item.kind))),
    usedElementCount: usedElements.length,
    effectiveInput: effectiveInput || baseNormalizedText,
  }
}
