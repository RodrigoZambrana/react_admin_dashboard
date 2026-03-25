/* eslint-disable  @typescript-eslint/no-explicit-any */
import { normalizeCurrencyCode } from '@/utils/currency'
import i18n from '@/locales'
import type { SalesDocumentResource } from '@/services/SalesService'
import { resolveSalesUnit, type SalesUnitAwareItem } from '@/utils/salesUnitCalculation'
import {
  computeSalesDocumentLine,
  computeSalesDocumentSummary,
  createSalesDocumentRounder,
  detectSalesDocumentCurrency,
  mapSalesDocumentItemsForComputation,
  type SalesDocumentMode,
  type SalesDocumentSummaryComputation,
} from '@/utils/salesDocumentCalculations'
import { ORDER_STATUS_IDS } from '@/constants/orderStatus'

const coerceDocumentNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export type FxSnapshot = {
  base: string
  rates: Record<string, number>
  generatedAt?: string
}

const VALIDITY_ALIAS_KEYS = [
  'validUntil',
  'valid_until',
  'validUntilDate',
  'valid_until_at',
  'validityDate',
  'validity_date',
] as const

type ValidityAliasKey = (typeof VALIDITY_ALIAS_KEYS)[number]

export type ValidityRecord = Partial<Record<ValidityAliasKey, unknown>> &
  Record<string, unknown>

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const assignValidityAliases = (raw: unknown): ValidityRecord => {
  const result: Partial<Record<ValidityAliasKey, unknown>> = {}
  for (const key of VALIDITY_ALIAS_KEYS) {
    result[key] = raw
  }
  return result as ValidityRecord
}

export const parseValidityRecord = (value: unknown): ValidityRecord | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (isPlainObject(value)) {
    return value as ValidityRecord
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.length) {
      return null
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (isPlainObject(parsed)) {
        return parsed as ValidityRecord
      }
      if (parsed === null || parsed === undefined) {
        return null
      }
      return assignValidityAliases(parsed)
    } catch {
      return assignValidityAliases(trimmed)
    }
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return null
    }
    return parseValidityRecord(value[0])
  }

  if (value instanceof Date || typeof value === 'number') {
    return assignValidityAliases(value)
  }

  return assignValidityAliases(value)
}

const PAYMENT_STATUS_EPSILON = 0.01

const toNumericValue = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object' && value !== null && typeof (value as any).toString === 'function') {
    const parsed = Number((value as any).toString())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const derivePaymentAwareStatusId = (
  baseStatusId: number | null | undefined,
  outstanding: number | null | undefined,
  mode: SalesDocumentMode,
) => {
  const normalizedBase = Number(baseStatusId ?? 0)
  if (mode === 'budget') {
    return normalizedBase
  }
  if (
    normalizedBase === ORDER_STATUS_IDS.CANCELLED ||
    normalizedBase === ORDER_STATUS_IDS.DELIVERED
  ) {
    return normalizedBase
  }
  if (outstanding === null || outstanding === undefined) {
    return normalizedBase || ORDER_STATUS_IDS.PENDING
  }
  return outstanding > PAYMENT_STATUS_EPSILON ? ORDER_STATUS_IDS.PENDING : ORDER_STATUS_IDS.PAID
}

const toNullableStatusId = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('id' in record && record.id !== undefined) {
      const normalized = toNullableStatusId(record.id)
      if (normalized !== null) {
        return normalized
      }
    }
    if ('code' in record && record.code !== undefined) {
      const normalized = toNullableStatusId(record.code)
      if (normalized !== null) {
        return normalized
      }
    }
    return null
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  const normalized = Math.trunc(numeric)
  return normalized > 0 ? normalized : null
}

const resolveStatusIdFromSource = (source: any): number | null => {
  if (!source || typeof source !== 'object') {
    return toNullableStatusId(source)
  }
  const record = source as Record<string, unknown>
  const rawStatus = record.status
  const statusRecord = isPlainObject(rawStatus) ? (rawStatus as Record<string, unknown>) : undefined
  const candidates: unknown[] = [
    record.statusId,
    statusRecord?.id,
    statusRecord?.code,
    record.statusCode,
    statusRecord,
    !statusRecord ? rawStatus : undefined,
    record.progressStatus,
    (record as any).status_id,
    (record as any).statusCodeId,
  ]
  for (const candidate of candidates) {
    const normalized = toNullableStatusId(candidate)
    if (normalized !== null) {
      return normalized
    }
  }
  return null
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
  const neighborhood = getFirstNonEmpty(
    o[`${prefix}Neighborhood`],
    ...nestedValues('neighborhood'),
  )
  const department = getFirstNonEmpty(
    o[`${prefix}Department`],
    ...nestedValues('department'),
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

  const line3 = [city, neighborhood, department || stateOrRegion].filter(Boolean).join(', ')
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

export function adaptOrderToDetailsView(
  o: any,
  options?: { mode?: SalesDocumentMode },
) {
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
  const normalizedOrderCurrency =
    normalizeCurrencyCode(o.orderCurrency) ||
    detectSalesDocumentCurrency(o.items, o.orderCurrency) ||
    'USD'
  const resolvedMode: SalesDocumentMode =
    options?.mode === 'budget' ? 'budget' : 'order'
  const roundAmount = createSalesDocumentRounder(resolvedMode)
  const rawItems = Array.isArray(o.items) ? o.items : []
  const summaryItems = mapSalesDocumentItemsForComputation(rawItems)
  const product = rawItems.map((it: any, index: number) => {
    const computeItemCandidate = summaryItems[index] ?? mapSalesDocumentItemsForComputation([it])[0]
    const computeItem: SalesUnitAwareItem =
      computeItemCandidate ?? {
        price: 0,
        unitPrice: 0,
        qty: 0,
        unitOfMeasure: resolveSalesUnit(undefined, undefined),
        pricingMethod: resolveSalesUnit(undefined, undefined),
      }
    const resolvedUnit = resolveSalesUnit(
      computeItem.unitOfMeasure,
      computeItem.pricingMethod,
    )
    const rawQty = Number(computeItem.qty ?? 0)
    const priceForCalculation = Number(computeItem.unitPrice ?? computeItem.price ?? 0)
    const unitCostAmount = Number(
      it.unitCostOrderCurrency ??
        it.unitCostAmount ??
        0,
    )
    const resolvedCostCurrency =
      normalizeCurrencyCode(it.unitCostCurrency, normalizedOrderCurrency) ||
      normalizedOrderCurrency
    const lineComputation = computeSalesDocumentLine(computeItem, roundAmount)
    const customAttributes = computeItem.customAttributes
      ? { ...computeItem.customAttributes }
      : undefined
        return {
          id: String(it.id),
          productId: it.productId ? String(it.productId) : undefined,
          name: it.name,
          productCode: it.product?.productCode || '',
          img: it.img || '',
          price: lineComputation.unitPrice,
          quantity: rawQty,
          qty: rawQty,
          total: lineComputation.lineTotal,
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
          effectiveQuantity: lineComputation.effectiveQuantity,
          unitCostOrderCurrency: Number.isFinite(unitCostAmount)
            ? unitCostAmount
            : 0,
          costCurrency: resolvedCostCurrency,
          costTotal: Number.isFinite(unitCostAmount)
            ? Math.round(unitCostAmount * rawQty * 100) / 100
            : 0,
        }
  })
  const summaryComputation = computeSalesDocumentSummary(summaryItems, {
    mode: resolvedMode,
    round: roundAmount,
    deliveryFees: shipping.deliveryFees,
    taxRate:
      (o as any)?.taxRate ??
      (o as any)?.tax_rate ??
      (o as any)?.taxRateSnapshot ??
      (o as any)?.tax_rate_snapshot,
    fallbackTaxAmount:
      (o as any)?.tax ??
      (o as any)?.taxAmount ??
      (o as any)?.tax_amount,
  })
  const paymentSummary = {
    subTotal: summaryComputation.subTotal,
    tax: summaryComputation.tax,
    deliveryFees: summaryComputation.deliveryFees,
    total: summaryComputation.total,
    currency: normalizedOrderCurrency,
  }
  const normalizedPayments = (() => {
    const source = o.payments
    if (!source || typeof source !== 'object') {
      return source ?? null
    }
    const summarySource = source.summary as Record<string, unknown> | null | undefined
    const normalizedSummaryCurrency =
      normalizeCurrencyCode(
        (summarySource?.currency as string | undefined) ?? undefined,
        normalizedOrderCurrency,
      ) ||
      normalizedOrderCurrency ||
      ((summarySource?.currency as string | undefined) ?? undefined)
    const summary = summarySource
      ? {
          ...summarySource,
          currency: normalizedSummaryCurrency,
        }
      : null
    const records = Array.isArray(source.records)
      ? source.records.map((record: any) => ({
          ...record,
          attachments: Array.isArray(record?.attachments)
            ? record.attachments.map((attachment: any) => ({ ...attachment }))
            : [],
        }))
      : []
    return {
      ...source,
      summary,
      records,
    }
  })()
  const outstandingAmount = toNumericValue(normalizedPayments?.summary?.outstanding)
  const normalizedShipping = {
    ...shipping,
    deliveryFees: summaryComputation.deliveryFees,
  }
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
        previousBudgets: Math.max(
          Number((o.customer as any)?.previousBudgets ?? 0),
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
  const resolvedStatusId = resolveStatusIdFromSource(o)
  const paymentAwareStatusId = derivePaymentAwareStatusId(
    resolvedStatusId,
    outstandingAmount,
    resolvedMode,
  )
  return {
    id: String(o.id),
    uuid: typeof o.uuid === 'string' && o.uuid.trim().length > 0 ? o.uuid.trim() : undefined,
    orderNumber:
      typeof o.orderNumber === 'string' && o.orderNumber.trim().length > 0
        ? o.orderNumber.trim()
        : typeof o.uuid === 'string' && o.uuid.trim().length > 0
          ? o.uuid.trim()
          : undefined,
    reference:
      typeof o.reference === 'string' && o.reference.trim().length > 0
        ? o.reference.trim()
        : typeof o.orderNumber === 'string' && o.orderNumber.trim().length > 0
          ? o.orderNumber.trim()
          : typeof o.uuid === 'string' && o.uuid.trim().length > 0
            ? o.uuid.trim()
            : undefined,
    progressStatus: paymentAwareStatusId ?? 0,
    payementStatus,
    dateTime,
    validUntil,
    validityDate: validUntil,
    paymentSummary,
    payments: normalizedPayments,
    shipping: normalizedShipping,
    product,
    activity: [],
    customer,
    fxSnapshot,
    comment,
    disclaimer,
  }
}

type SalesDocumentListAdaptOptions = {
  mode?: SalesDocumentMode
  resource?: SalesDocumentResource
}

export function adaptSalesDocumentListRecord<T extends Record<string, any>>(
  raw: T,
  options?: SalesDocumentListAdaptOptions,
): T & {
  totalAmount: number
  orderCurrency?: string
  paymentSummary?: Record<string, unknown>
  computedSummary: SalesDocumentSummaryComputation
} {
  if (!raw || typeof raw !== 'object') {
    return raw
  }
  const resolvedMode: SalesDocumentMode =
    options?.mode ?? (options?.resource === 'budgets' ? 'budget' : 'order')
  const roundValue = createSalesDocumentRounder(resolvedMode)
  const summaryItems = mapSalesDocumentItemsForComputation((raw as any)?.items)
  let summary = computeSalesDocumentSummary(summaryItems, {
    mode: resolvedMode,
    round: roundValue,
    deliveryFees: (raw as any)?.deliveryFees ?? (raw as any)?.shipping?.deliveryFees,
    taxRate:
      (raw as any)?.taxRate ??
      (raw as any)?.tax_rate ??
      (raw as any)?.taxRateSnapshot ??
      (raw as any)?.tax_rate_snapshot,
    fallbackTaxAmount:
      (raw as any)?.tax ??
      (raw as any)?.taxAmount ??
      (raw as any)?.tax_amount,
  })
  const fallbackTotals = {
    deliveryFees:
      (raw as any)?.deliveryFees ??
      (raw as any)?.shipping?.deliveryFees ??
      (raw as any)?.paymentSummary?.deliveryFees,
    total:
      (raw as any)?.totalAmount ??
      (raw as any)?.grandTotal ??
      (raw as any)?.grand_total ??
      (raw as any)?.total,
    tax:
      (raw as any)?.tax ??
      (raw as any)?.taxAmount ??
      (raw as any)?.tax_amount ??
      (raw as any)?.paymentSummary?.tax,
  }
  const fallbackDelivery = coerceDocumentNumber(fallbackTotals.deliveryFees, 0)
  const fallbackTotal = coerceDocumentNumber(fallbackTotals.total, 0)
  const fallbackTax = coerceDocumentNumber(fallbackTotals.tax, 0)
  const fallbackSubTotal = Math.max(fallbackTotal - fallbackDelivery, 0)

  const shouldUseFallbackSummary =
    summaryItems.length === 0 || (!summary.total && fallbackTotal !== 0)

  if (shouldUseFallbackSummary) {
    summary = {
      lines: summary.lines,
      subTotal: roundValue(fallbackSubTotal),
      deliveryFees: roundValue(fallbackDelivery),
      total: roundValue(fallbackTotal),
      tax: roundValue(fallbackTax),
    }
  } else {
    if (!summary.deliveryFees && fallbackDelivery) {
      summary.deliveryFees = roundValue(fallbackDelivery)
    }
    if (!summary.tax && fallbackTax) {
      summary.tax = roundValue(fallbackTax)
    }
  }
  const currency =
    detectSalesDocumentCurrency((raw as any)?.items, (raw as any)?.orderCurrency) ??
    normalizeCurrencyCode((raw as any)?.orderCurrency)
  const existingPaymentSummary =
    (raw as any)?.paymentSummary && typeof (raw as any)?.paymentSummary === 'object'
      ? { ...(raw as any).paymentSummary }
      : undefined
  if (existingPaymentSummary) {
    existingPaymentSummary.subTotal = summary.subTotal
    existingPaymentSummary.deliveryFees = summary.deliveryFees
    existingPaymentSummary.tax = summary.tax
    existingPaymentSummary.total = summary.total
    existingPaymentSummary.currency =
      normalizeCurrencyCode(existingPaymentSummary.currency as string | undefined, currency ?? undefined) ??
      currency ?? existingPaymentSummary.currency
  }
  return {
    ...raw,
    totalAmount: summary.total,
    ...(currency ? { orderCurrency: currency } : {}),
    ...(existingPaymentSummary ? { paymentSummary: existingPaymentSummary } : {}),
    computedSummary: summary,
  }
}
