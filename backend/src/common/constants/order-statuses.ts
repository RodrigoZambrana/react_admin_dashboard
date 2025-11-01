import { DocumentType } from '@prisma/client'

export type OrderStatusCode =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'delivered'
  | 'budget_draft'
  | 'budget_sent'
  | 'budget_accepted'
  | 'budget_converted'
  | 'budget_cancelled'
  | 'budget_expired'

export type OrderStatusDefinition = {
  id: number
  code: OrderStatusCode
  documentTypes: DocumentType[]
  label: string
  color: string
  translations: Record<string, string>
  isDefault?: boolean
  isTerminal?: boolean
}

const ORDER_STATUS_DEFINITIONS: OrderStatusDefinition[] = [
  {
    id: 100,
    code: 'pending',
    documentTypes: [DocumentType.ORDER],
    label: 'Pendiente',
    color: 'orange',
    translations: {
      es: 'Pendiente',
      en: 'Pending',
    },
    isDefault: true,
  },
  {
    id: 200,
    code: 'paid',
    documentTypes: [DocumentType.ORDER],
    label: 'Pagado',
    color: 'green',
    translations: {
      es: 'Pagado',
      en: 'Paid',
    },
  },
  {
    id: 300,
    code: 'cancelled',
    documentTypes: [DocumentType.ORDER],
    label: 'Cancelado',
    color: 'red',
    translations: {
      es: 'Cancelado',
      en: 'Cancelled',
    },
    isTerminal: true,
  },
  {
    id: 400,
    code: 'delivered',
    documentTypes: [DocumentType.ORDER],
    label: 'Entregado',
    color: 'green',
    translations: {
      es: 'Entregado',
      en: 'Delivered',
    },
    isTerminal: true,
  },
  {
    id: 1000,
    code: 'budget_draft',
    documentTypes: [DocumentType.BUDGET],
    label: 'Presupuesto - Borrador',
    color: '#9ca3af',
    translations: {
      es: 'Presupuesto - Borrador',
      en: 'Quote - Draft',
    },
    isDefault: true,
  },
  {
    id: 1010,
    code: 'budget_sent',
    documentTypes: [DocumentType.BUDGET],
    label: 'Presupuesto - Enviado',
    color: '#3b82f6',
    translations: {
      es: 'Presupuesto - Enviado',
      en: 'Quote - Sent',
    },
  },
  {
    id: 1020,
    code: 'budget_accepted',
    documentTypes: [DocumentType.BUDGET],
    label: 'Presupuesto - Aceptado',
    color: '#10b981',
    translations: {
      es: 'Presupuesto - Aceptado',
      en: 'Quote - Accepted',
    },
  },
  {
    id: 1030,
    code: 'budget_converted',
    documentTypes: [DocumentType.BUDGET],
    label: 'Presupuesto - Convertido',
    color: '#22c55e',
    translations: {
      es: 'Presupuesto - Convertido',
      en: 'Quote - Converted',
    },
    isTerminal: true,
  },
  {
    id: 1040,
    code: 'budget_cancelled',
    documentTypes: [DocumentType.BUDGET],
    label: 'Presupuesto - Cancelado',
    color: '#ef4444',
    translations: {
      es: 'Presupuesto - Cancelado',
      en: 'Quote - Cancelled',
    },
    isTerminal: true,
  },
  {
    id: 1050,
    code: 'budget_expired',
    documentTypes: [DocumentType.BUDGET],
    label: 'Presupuesto - Expirado',
    color: '#f97316',
    translations: {
      es: 'Presupuesto - Expirado',
      en: 'Quote - Expired',
    },
    isTerminal: true,
  },
]

const ORDER_STATUS_BY_ID = new Map(ORDER_STATUS_DEFINITIONS.map((definition) => [definition.id, definition]))
const ORDER_STATUS_BY_CODE = new Map(ORDER_STATUS_DEFINITIONS.map((definition) => [definition.code, definition]))

const normalizeLocale = (locale?: string | null) => {
  if (!locale) {
    return null
  }
  const trimmed = locale.trim()
  if (!trimmed) {
    return null
  }
  const [lang] = trimmed.split(/[-_]/)
  return lang.toLowerCase()
}

const resolveLabel = (definition: OrderStatusDefinition, locale?: string | null) => {
  const normalized = normalizeLocale(locale)
  if (normalized && definition.translations[normalized]) {
    return definition.translations[normalized]
  }
  return definition.label
}

export const ORDER_STATUS_CODES = {
  PENDING: 100,
  PAID: 200,
  CANCELLED: 300,
  DELIVERED: 400,
  BUDGET_DRAFT: 1000,
} as const

export const listOrderStatuses = (documentType?: DocumentType | null, locale?: string | null) => {
  const targetType = documentType ?? null
  const list = targetType
    ? ORDER_STATUS_DEFINITIONS.filter((definition) => definition.documentTypes.includes(targetType))
    : ORDER_STATUS_DEFINITIONS
  return list.map((definition) => ({
    id: definition.id,
    code: definition.code,
    color: definition.color,
    label: resolveLabel(definition, locale),
    translations: { ...definition.translations },
    documentTypes: [...definition.documentTypes],
    isDefault: definition.isDefault ?? false,
    isTerminal: definition.isTerminal ?? false,
  }))
}

export const findOrderStatusById = (id?: number | null) => {
  if (!id) {
    return null
  }
  return ORDER_STATUS_BY_ID.get(id) ?? null
}

export const findOrderStatusByCode = (code?: string | null) => {
  if (!code) {
    return null
  }
  return ORDER_STATUS_BY_CODE.get(code as OrderStatusCode) ?? null
}

export const matchOrderStatus = (input: unknown, documentType?: DocumentType) => {
  if (input === null || input === undefined) {
    return null
  }

  if (typeof input === 'number') {
    const byId = findOrderStatusById(input)
    if (byId && (!documentType || byId.documentTypes.includes(documentType))) {
      return byId
    }
    return null
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      return null
    }

    const numeric = Number(trimmed)
    if (Number.isFinite(numeric) && numeric > 0) {
      const byId = findOrderStatusById(numeric)
      if (byId && (!documentType || byId.documentTypes.includes(documentType))) {
        return byId
      }
    }

    const normalizedCode = trimmed.toLowerCase().replace(/\s+/g, '_')
    const byCode = findOrderStatusByCode(normalizedCode)
    if (byCode && (!documentType || byCode.documentTypes.includes(documentType))) {
      return byCode
    }

    const normalizedLabel = trimmed.toLowerCase()
    return (
      ORDER_STATUS_DEFINITIONS.find((definition) => {
        if (documentType && !definition.documentTypes.includes(documentType)) {
          return false
        }
        if (definition.label.toLowerCase() === normalizedLabel) {
          return true
        }
        return Object.values(definition.translations).some(
          (translation) => translation.toLowerCase() === normalizedLabel,
        )
      }) ?? null
    )
  }

  return null
}

export const getDefaultStatusForDocument = (documentType: DocumentType) =>
  ORDER_STATUS_DEFINITIONS.find(
    (definition) => definition.documentTypes.includes(documentType) && definition.isDefault,
  ) ?? null

