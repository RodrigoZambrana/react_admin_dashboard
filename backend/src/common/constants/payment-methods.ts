export type PaymentMethodCode = 'mercado_pago' | 'cash'

export type PaymentMethodDefinition = {
  id: number
  code: PaymentMethodCode
  label: string
  translations: Record<string, string>
}

const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  {
    id: 1,
    code: 'mercado_pago',
    label: 'Mercado Pago',
    translations: {
      es: 'Mercado Pago',
      en: 'Mercado Pago',
    },
  },
  {
    id: 2,
    code: 'cash',
    label: 'Efectivo',
    translations: {
      es: 'Efectivo',
      en: 'Cash',
    },
  },
]

const PAYMENT_METHODS_BY_ID = new Map(PAYMENT_METHODS.map((definition) => [definition.id, definition]))
const PAYMENT_METHODS_BY_CODE = new Map(PAYMENT_METHODS.map((definition) => [definition.code, definition]))

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

const resolveLabel = (definition: PaymentMethodDefinition, locale?: string | null) => {
  const normalized = normalizeLocale(locale)
  if (normalized && definition.translations[normalized]) {
    return definition.translations[normalized]
  }
  return definition.label
}

export const listPaymentMethods = (locale?: string | null) =>
  PAYMENT_METHODS.map((definition) => ({
    id: definition.id,
    code: definition.code,
    label: resolveLabel(definition, locale),
    translations: { ...definition.translations },
  }))

export const findPaymentMethodById = (id?: number | null) => {
  if (!id) {
    return null
  }
  return PAYMENT_METHODS_BY_ID.get(id) ?? null
}

export const findPaymentMethodByCode = (code?: string | null) => {
  if (!code) {
    return null
  }
  return PAYMENT_METHODS_BY_CODE.get(code as PaymentMethodCode) ?? null
}

export const matchPaymentMethod = (input: unknown) => {
  if (input === null || input === undefined) {
    return null
  }

  if (typeof input === 'number') {
    return findPaymentMethodById(input)
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      return null
    }

    const numeric = Number(trimmed)
    if (Number.isFinite(numeric) && numeric > 0) {
      const byId = findPaymentMethodById(numeric)
      if (byId) {
        return byId
      }
    }

    const normalizedCode = trimmed.toLowerCase().replace(/\s+/g, '_')
    const byCode = findPaymentMethodByCode(normalizedCode)
    if (byCode) {
      return byCode
    }

    const normalizedLabel = trimmed.toLowerCase()
    return (
      PAYMENT_METHODS.find((definition) => {
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

export const DEFAULT_PAYMENT_METHOD_ID = PAYMENT_METHODS[0]?.id ?? 1

