const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s#:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const CUSTOMER_ROLES = new Set(['customer_public', 'customer_authenticated'])

const ORDER_LOOKUP_PATTERNS = [
  /\b(mi pedido|mi orden|estado del pedido|estado de mi pedido|seguimiento del pedido|seguimiento de mi pedido|donde esta mi pedido|donde va mi pedido|como va mi pedido)\b/u,
  /\b(pedido|orden)\s*(?:#|nro|numero|número|ref|referencia)\s*([a-z0-9-]{4,})\b/u,
]

const BUDGET_LOOKUP_PATTERNS = [
  /\b(mi presupuesto|mi cotizacion|mi cotización|estado del presupuesto|estado de mi presupuesto|seguimiento del presupuesto|seguimiento de mi presupuesto)\b/u,
  /\b(presupuesto|cotizacion|cotización)\s*(?:#|nro|numero|número|ref|referencia)\s*([a-z0-9-]{4,})\b/u,
]

const PRIVATE_ACCOUNT_PATTERNS = [
  /\b(mi direccion|mi dirección|direccion de entrega|dirección de entrega|domicilio de entrega)\b/u,
  /\b(mi factura|mis facturas|factura de mi pedido|facturas de mi cuenta)\b/u,
  /\b(mi correo|mi email|mail del sistema|correo del sistema|email del sistema)\b/u,
]

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i

const ORDER_REF_PATTERN = /\b(?:ord|pedido|orden)[-:#\s]?0*(\d{3,})\b/i
const BUDGET_REF_PATTERN = /\b(?:bud|presupuesto|cotizacion|cotización)[-:#\s]?0*(\d{3,})\b/i

const extractIdentifier = (normalizedInput, documentType) => {
  const uuidMatch = normalizedInput.match(UUID_PATTERN)
  if (uuidMatch?.[0]) {
    return uuidMatch[0]
  }

  const refMatch =
    documentType === 'BUDGET'
      ? normalizedInput.match(BUDGET_REF_PATTERN)
      : normalizedInput.match(ORDER_REF_PATTERN)

  if (refMatch?.[1]) {
    return String(Number(refMatch[1]))
  }

  return null
}

const detectDocumentLookupType = (normalizedInput) => {
  if (BUDGET_LOOKUP_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return 'BUDGET'
  }
  if (ORDER_LOOKUP_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return 'ORDER'
  }
  return null
}

const hasPrivateAccountSignal = (normalizedInput) =>
  PRIVATE_ACCOUNT_PATTERNS.some((pattern) => pattern.test(normalizedInput))

export const classifyCustomerProtectedDataRequest = ({ role, input }) => {
  if (!CUSTOMER_ROLES.has(String(role || ''))) {
    return null
  }

  const normalizedInput = normalizeText(input)
  if (!normalizedInput) {
    return null
  }

  const documentType = detectDocumentLookupType(normalizedInput)
  const requestType = hasPrivateAccountSignal(normalizedInput)
    ? normalizedInput.includes('factura')
      ? 'invoice'
      : normalizedInput.includes('direccion') || normalizedInput.includes('domicilio')
        ? 'address'
        : 'system_contact'
    : null

  if (!documentType && !requestType) {
    return null
  }

  if (role !== 'customer_authenticated') {
    return {
      category: 'auth_required',
      suggestedIntent: 'customer.auth_required',
      confidence: 0.97,
      decisionPath: ['classifier:auth_required'],
      documentType,
      identifier: documentType ? extractIdentifier(normalizedInput, documentType) : null,
      requestType,
    }
  }

  if (documentType) {
    return {
      category: 'owned_document_request',
      suggestedIntent: 'customer.owned_document_request',
      confidence: 0.94,
      decisionPath: ['classifier:owned_document_request'],
      documentType,
      identifier: extractIdentifier(normalizedInput, documentType),
      requestType: null,
    }
  }

  return {
    category: 'private_account_data',
    suggestedIntent: 'customer.private_account_data',
    confidence: 0.95,
    decisionPath: ['classifier:private_account_data'],
    documentType: null,
    identifier: null,
    requestType,
  }
}
