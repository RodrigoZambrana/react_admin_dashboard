/* eslint-disable  @typescript-eslint/no-explicit-any */
import { normalizeCurrencyCode } from '@/utils/currency'
import i18n from '@/locales'
import {
  calculateLineTotal,
  getDerivedUnitPrice,
  getEffectiveQuantity,
  resolveSalesUnit,
} from '@/utils/salesUnitCalculation'

export type FxSnapshot = {
  base: string
  rates: Record<string, number>
  generatedAt?: string
}
export function toUnixSeconds(date: any): number {
  try {
    const d = date ? new Date(date) : new Date()
    return Math.floor(d.getTime() / 1000)
  } catch {
    return Math.floor(Date.now() / 1000)
  }
}

const normalizeCornerValue = (value?: string) => {
  if (!value) {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.replace(/^(?:corner|esquina)[:\s]*/i, '').trim()
}

const translateCorner = (corner: string) => {
  if (!corner) {
    return ''
  }
  const locale = (i18n.language || '').toLowerCase()
  const translationOptions = {
    corner,
    defaultValue: `esquina ${corner}`,
  }
  if (locale.startsWith('es')) {
    return i18n.t('text.labels.cornerFormat', translationOptions)
  }
  return i18n.t('text.labels.cornerFormat', {
    ...translationOptions,
    lng: 'es',
  })
}

const stripCornerLine = (value?: string, normalizedCorner?: string) => {
  if (!value) {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  const normalized = trimmed.replace(/^(?:corner|esquina)[:\s]*/i, '').trim()
  if (!normalized) {
    return ''
  }
  if (
    normalizedCorner &&
    normalizedCorner.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0
  ) {
    return ''
  }
  return trimmed
}

export function toAddressLines(o: any, prefix: 'shipping' | 'billing') {
  const getFirstNonEmpty = (...values: Array<unknown>) => {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.length > 0) {
          return trimmed
        }
      }
    }
    return ''
  }

  if (!o) {
    return { line1: '', line2: '', line3: '', line4: '' }
  }

  const nestedAddress =
    ((typeof o[`${prefix}Address`] === 'object' && o[`${prefix}Address`]) ||
      (typeof o[prefix] === 'object' && o[prefix]) ||
      {}) as Record<string, unknown>
  const nestedValues = (...keys: string[]) => keys.map((key) => nestedAddress[key])

  const rawCorner = getFirstNonEmpty(
    ...nestedValues('corner'),
    o[`${prefix}Corner`],
  )
  const normalizedCorner = normalizeCornerValue(rawCorner)
  const localizedCorner = translateCorner(normalizedCorner)

  const nestedStreetLine = (() => {
    const street = getFirstNonEmpty(
      ...nestedValues('street', 'addressLine1', 'line1', 'lineOne'),
    )
    const number = getFirstNonEmpty(...nestedValues('number'))
    if (!street && !number) {
      return ''
    }
    return [street, number].filter(Boolean).join(' ').trim()
  })()

  const nestedLine2 = (() => {
    const apartment = getFirstNonEmpty(
      ...nestedValues('apartment', 'unit'),
    )
    const addressLine2 = getFirstNonEmpty(
      ...nestedValues('addressLine2', 'line2', 'lineTwo'),
    )
    const parts = [addressLine2]
    if (apartment) {
      parts.push(`Apt ${apartment}`)
    }
    return parts.filter(Boolean).join(' • ')
  })()

  const line1Base = getFirstNonEmpty(
    stripCornerLine(o[`${prefix}Address1`], normalizedCorner),
    nestedStreetLine,
  )
  const line1 = line1Base || localizedCorner
  const line2Segments: string[] = []
  if (line1Base && localizedCorner) {
    line2Segments.push(localizedCorner)
  }
  const additionalLine2 = stripCornerLine(o[`${prefix}Address2`], normalizedCorner)
  if (additionalLine2) {
    line2Segments.push(additionalLine2)
  }
  if (nestedLine2) {
    line2Segments.push(nestedLine2)
  }
  const line2 = line2Segments.join(' • ')
  const city = getFirstNonEmpty(
    o[`${prefix}City`],
    ...nestedValues('city'),
  )
  const stateOrRegion = getFirstNonEmpty(
    o[`${prefix}State`],
    ...nestedValues('state', 'region', 'province', 'country'),
  )
  const zip = getFirstNonEmpty(
    o[`${prefix}Zip`],
    ...nestedValues('zip', 'postalCode', 'postal_code'),
  )
  const country = getFirstNonEmpty(
    ...nestedValues('country'),
    o[`${prefix}Country`],
  )

  const line3 = [city, stateOrRegion].filter(Boolean).join(', ')
  const line4Parts = [zip]
  if (country && country !== stateOrRegion) {
    line4Parts.push(country)
  } else if (!zip && country) {
    line4Parts.push(country)
  }

  return {
    line1,
    line2,
    line3,
    line4: line4Parts.filter(Boolean).join(' • '),
  }
}

export function adaptOrderToDetailsView(o: any) {
  if (!o) return {}
  const dateTime = toUnixSeconds(o.date)
  const rawValidUntil = (() => {
    if (o?.validUntil !== undefined) {
      return o.validUntil
    }
    const candidates = [
      (o as any)?.valid_until,
      (o as any)?.valid_until_at,
      (o as any)?.validUntilDate,
      (o as any)?.validityDate,
      (o as any)?.validity_date,
    ]
    for (const candidate of candidates) {
      if (candidate !== undefined) {
        return candidate
      }
    }
    return undefined
  })()
  const validUntil = (() => {
    if (rawValidUntil === undefined || rawValidUntil === null) {
      return undefined
    }
    const normalized = toUnixSeconds(rawValidUntil)
    if (Number.isFinite(normalized)) {
      return normalized
    }
    if (rawValidUntil instanceof Date) {
      const asString = rawValidUntil.toString()
      return asString && asString !== 'Invalid Date' ? asString : undefined
    }
    if (typeof rawValidUntil === 'string') {
      const trimmed = rawValidUntil.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
    if (typeof rawValidUntil === 'number' && Number.isFinite(rawValidUntil)) {
      return rawValidUntil
    }
    return rawValidUntil ?? undefined
  })()
  const shipping = {
    deliveryFees: Number(o.deliveryFees || 0),
    estimatedMin: Number(o.estimatedMin || 0),
    estimatedMax: Number(o.estimatedMax || 0),
    shippingLogo: '',
    shippingVendor: o.shippingVendor || '',
  }
  const detectedCurrency = (() => {
    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        const code = normalizeCurrencyCode(item?.unitCurrency || item?.product?.currency || item?.currency)
        if (code) {
          return code
        }
      }
    }
    return undefined
  })()
  const normalizedOrderCurrency =
    normalizeCurrencyCode(o.orderCurrency, detectedCurrency) ||
    normalizeCurrencyCode(detectedCurrency)
  const paymentSummary = {
    subTotal: Number(o.subTotal || 0),
    tax: Number(o.tax || 0),
    deliveryFees: Number(o.deliveryFees || 0),
    total: Number(o.grandTotal || 0),
    currency: normalizedOrderCurrency,
  }
  const product = Array.isArray(o.items)
    ? o.items.map((it: any) => {
        const rawQty = Number(it.qty ?? 0)
        const customAttributes =
          it.customAttributes &&
          typeof it.customAttributes === 'object' &&
          Object.keys(it.customAttributes).length > 0
            ? { ...it.customAttributes }
            : undefined
        const resolvedUnit = resolveSalesUnit(
          it.pricingMethodSnapshot,
          (typeof it.pricingMethod === 'string' && it.pricingMethod) ||
            (typeof it.unitOfMeasure === 'string' && it.unitOfMeasure) ||
            undefined,
        )
        const priceForCalculation = Number(
          it.unitAmountOrderCurrency ??
            it.price ??
            it.unitAmount ??
            it.unitPrice ??
            0,
        )
        const unitCostAmount = Number(
          it.unitCostOrderCurrency ??
            it.unitCostAmount ??
            0,
        )
        const resolvedCostCurrency =
          normalizeCurrencyCode(it.unitCostCurrency, normalizedOrderCurrency) ||
          normalizedOrderCurrency
        const computeItem = {
          price: priceForCalculation,
          unitPrice: priceForCalculation,
          qty: rawQty,
          unitOfMeasure: resolvedUnit,
          pricingMethod: resolvedUnit,
          customAttributes,
        }
        const derivedUnitPrice = getDerivedUnitPrice(computeItem)
        const computedTotal = calculateLineTotal(computeItem)
        return {
          id: String(it.id),
          productId: it.productId ? String(it.productId) : undefined,
          name: it.name,
          productCode: it.product?.productCode || '',
          img: it.img || '',
          price: derivedUnitPrice,
          quantity: rawQty,
          qty: rawQty,
          total: computedTotal,
          currency: normalizedOrderCurrency,
          unitCurrency:
            normalizeCurrencyCode(it.unitCurrency, normalizedOrderCurrency) ||
            normalizeCurrencyCode(it?.product?.currency || it?.currency, normalizedOrderCurrency) ||
            normalizedOrderCurrency,
          unitAmount: Number(it.unitAmount ?? it.unitPrice ?? 0),
          unitAmountOrderCurrency: Number(it.unitAmountOrderCurrency ?? it.price ?? 0),
          unitPrice: priceForCalculation,
          conversionRate: Number(it.conversionRate ?? 1),
          details: {},
          comments: typeof it.comments === 'string' && it.comments.trim() ? it.comments.trim() : undefined,
          specSummary: typeof it.specSummary === 'string' && it.specSummary.trim() ? it.specSummary.trim() : undefined,
          specifications:
            typeof (it.specifications ?? it.product?.specifications) === 'string'
                ? String(it.specifications ?? it.product?.specifications).trim() || undefined
                : undefined,
          customAttributes,
          unitOfMeasure: resolvedUnit,
          pricingMethod: resolvedUnit,
          effectiveQuantity: getEffectiveQuantity(computeItem),
          unitCostOrderCurrency: Number.isFinite(unitCostAmount)
            ? unitCostAmount
            : 0,
          costCurrency: resolvedCostCurrency,
          costTotal: Number.isFinite(unitCostAmount)
            ? Math.round(unitCostAmount * rawQty * 100) / 100
            : 0,
        }
      })
    : []
  const fxSnapshot = (() => {
    const raw = o.fxRates
    const normalizedBase = normalizeCurrencyCode(raw?.base, normalizedOrderCurrency) || normalizedOrderCurrency
    if (!raw || typeof raw !== 'object' || !normalizedBase) {
      if (normalizedOrderCurrency) {
        return { base: normalizedOrderCurrency, rates: { [normalizedOrderCurrency]: 1 } } as FxSnapshot
      }
      return undefined
    }
    const rates: Record<string, number> = {}
    if (raw?.rates && typeof raw.rates === 'object') {
      Object.entries(raw.rates as Record<string, string | number>).forEach(([key, value]) => {
        const code = normalizeCurrencyCode(key, normalizedBase) || normalizeCurrencyCode(key) || key.toUpperCase()
        const numeric = Number(value)
        if (code && Number.isFinite(numeric) && numeric > 0) {
          rates[code] = numeric
        }
      })
    }
    rates[normalizedBase] = rates[normalizedBase] ?? 1
    return { base: normalizedBase, rates, generatedAt: raw.generatedAt } as FxSnapshot
  })()
  const customer = o.customer
    ? {
        id: o.customer.id,
        name: o.customer.name || '',
        email: o.customer.email || '',
        phone:
            (Array.isArray((o.customer as any).phoneNumbers) &&
                (o.customer as any).phoneNumbers[0]) ||
            o.customer.phoneNumber ||
            '',
        img: o.customer.img || '',
        previousOrder: Math.max(
          Number((o.customer as any)?.previousOrder ?? 0),
          0,
        ),
        shippingAddress: toAddressLines(o, 'shipping'),
        billingAddress: toAddressLines(o, 'billing'),
      }
    : undefined
  const payementStatus = o.paymentMethodId ? 0 : 1
  const comment = (() => {
    if (typeof o.comment === 'string') {
      return o.comment.trim()
    }
    if (typeof o.comments === 'string') {
      return o.comments.trim()
    }
    return ''
  })()
  const disclaimer = (() => {
    if (typeof o.disclaimer === 'string') {
      return o.disclaimer.trim()
    }
    return ''
  })()
  return {
    id: String(o.id),
    progressStatus: o.statusId || 0,
    payementStatus,
    dateTime,
    validUntil,
    validityDate: validUntil,
    paymentSummary,
    shipping,
    product,
    activity: [],
    customer,
    fxSnapshot,
    comment,
    disclaimer,
  }
}
