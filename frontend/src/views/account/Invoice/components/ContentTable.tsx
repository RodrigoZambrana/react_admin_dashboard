import { Fragment, useCallback, useMemo } from 'react'
import Table from '@/components/ui/Table'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import isLastChild from '@/utils/isLastChild'
import { useAppSelector } from '@/store'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import { convertAmountWithSnapshot } from '@/utils/fxConversion'
import { resolveTextDirection } from '@/utils/textDirection'
import type { FxSnapshot } from '@/adapters/sales'
import type { SalesDocumentResource } from '@/services/SalesService'
import {
    calculateLineTotal,
    getDerivedUnitPrice,
    getEffectiveQuantity,
    resolveSalesUnit,
} from '@/utils/salesUnitCalculation'

export type Product = {
    id: string
    name: string
    productCode?: string
    img?: string
    price?: number
    quantity?: number
    qty?: number
    total?: number
    currency?: string
    unitCurrency?: string
    unitAmount?: number
    unitAmountOrderCurrency?: number
    conversionRate?: number
    details?: Record<string, string[]>
    comments?: string
    specSummary?: string
    specifications?: string
    customAttributes?: Record<string, unknown>
    unitOfMeasure?: string | null
    pricingMethod?: string | null
    effectiveQuantity?: number
    unitPrice?: number
}

export type Summary = {
    subTotal?: number
    tax?: number
    deliveryFees?: number
    total?: number
    taxRate?: number
    currency?: string
}

type ContentTableProps = {
    products?: Product[]
    summary?: Partial<Summary>
    orderCurrency?: string
    fxSnapshot?: FxSnapshot | null
    resource?: SalesDocumentResource
}

const { Tr, Th, Td, THead, TBody, TFoot } = Table

const columnHelper = createColumnHelper<Product>()

const MAX_MEASUREMENT_DECIMALS = 3

const SPEC_KEY_PRIORITY: Record<string, number> = {
    width: 0,
    height: 1,
    length: 2,
}

const getNumeric = (value?: number | string | null) => {
    if (value === null || value === undefined) {
        return undefined
    }
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
}

const resolvePriceInOrderCurrency = (
    row: Product,
    orderCurrency: string,
    fxSnapshot?: FxSnapshot | null,
) => {
    const explicitPrice = getNumeric(row.price)
    if (explicitPrice !== undefined) {
        return explicitPrice
    }
    const total = getNumeric(row.total)
    const qty = getNumeric(row.quantity)
    if (
        total !== undefined &&
        qty !== undefined &&
        qty !== 0
    ) {
        return total / qty
    }
    const orderUnitAmount = getNumeric(row.unitAmountOrderCurrency)
    if (orderUnitAmount !== undefined) {
        return orderUnitAmount
    }
    const unitAmount = getNumeric(row.unitAmount)
    const unitCurrency =
        normalizeCurrencyCode(row.unitCurrency, orderCurrency) ||
        orderCurrency
    if (unitAmount !== undefined && unitCurrency) {
        const converted = convertAmountWithSnapshot(
            unitAmount,
            unitCurrency,
            orderCurrency,
            fxSnapshot,
        )
        if (converted !== undefined) {
            return converted
        }
        if (Number.isFinite(row.conversionRate) && row.conversionRate) {
            return unitAmount * Number(row.conversionRate)
        }
    }
    return 0
}

const formatSpecKey = (key: string) =>
    key
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())

const normalizeSpecText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\b(ancho|width)\b/g, 'width')
        .replace(/\b(alto|height)\b/g, 'height')
        .replace(/\b(largo|length)\b/g, 'length')
        .replace(/\s+/g, ' ')
        .trim()

const sanitizeSpecEntry = (value: string) => {
    const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    const filtered = lines.filter((line) => {
        const normalized = normalizeSpecText(line)
        if (!normalized) {
            return false
        }
        if (/^(especificaciones(?: del)? producto|product specifications?)/.test(normalized)) {
            return false
        }
        return true
    })
    return filtered.join('\n')
}

type FormatAttributeValue = (
    key: string,
    value: unknown,
    normalizedKey: string,
) => string | undefined

const resolveSpecifications = (
    row: Product,
    options?: {
        translateKey?: (key: string) => string
        formatAttributeValue?: FormatAttributeValue
        skipSpecSummaryIfCustomAttributes?: boolean
    },
) => {
    const translateKey = options?.translateKey ?? formatSpecKey
    const formatAttributeValue =
        options?.formatAttributeValue ??
        ((_key: string, value: unknown) => {
            if (value === null || value === undefined) {
                return undefined
            }
            const text = String(value).trim()
            return text.length > 0 ? text : undefined
        })
    const parts: string[] = []
    const seen = new Set<string>()
    const pushUnique = (value: string | undefined) => {
        if (!value) {
            return
        }
        const trimmed = value.trim()
        if (!trimmed) {
            return
        }
        const sanitized = sanitizeSpecEntry(trimmed)
        if (!sanitized) {
            return
        }
        const normalized = normalizeSpecText(sanitized)
        if (seen.has(normalized)) {
            return
        }
        seen.add(normalized)
        parts.push(sanitized)
    }
    const attrs = row.customAttributes
    let hasCustomAttributes = false
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
        const entries = Object.entries(attrs)
            .map(([key, value], index) => ({
                key,
                value,
                normalizedKey: normalizeSpecText(key),
                index,
            }))
            .filter(({ value }) => {
                if (value === null || value === undefined) {
                    return false
                }
                if (typeof value === 'string') {
                    return value.trim().length > 0
                }
                if (typeof value === 'number') {
                    return Number.isFinite(value)
                }
                if (
                    typeof value === 'object' &&
                    value &&
                    'toString' in value &&
                    typeof value.toString === 'function'
                ) {
                    const text = (value as { toString: () => string }).toString()
                    return text.trim().length > 0 && text !== '[object Object]'
                }
                return false
            })
        entries.sort((a, b) => {
            const priorityA = SPEC_KEY_PRIORITY[a.normalizedKey] ?? Number.MAX_SAFE_INTEGER
            const priorityB = SPEC_KEY_PRIORITY[b.normalizedKey] ?? Number.MAX_SAFE_INTEGER
            if (priorityA !== priorityB) {
                return priorityA - priorityB
            }
            return a.index - b.index
        })
        for (const entry of entries) {
            const formatted = formatAttributeValue(
                entry.key,
                entry.value,
                entry.normalizedKey,
            )
            if (!formatted) {
                continue
            }
            hasCustomAttributes = true
            const label = translateKey(entry.key)
            pushUnique(`${label}: ${formatted}`)
        }
    }
    if (
        typeof row.specSummary === 'string' &&
        (!options?.skipSpecSummaryIfCustomAttributes || !hasCustomAttributes)
    ) {
        pushUnique(row.specSummary)
    }
    if (typeof row.specifications === 'string') {
        pushUnique(row.specifications)
    }
    return parts.join('\n') || undefined
}

const resolveRawQuantity = (row: Product) =>
    getNumeric(row.quantity) ?? getNumeric(row.qty)

const ProductColumn = ({ row }: { row: Product }) => {
    const details = row.details ?? {}
    const detailKeys = Object.keys(details)
    return (
        <div className="flex">
            <div className="ltr:ml-2 rtl:mr-2">
                <h6 className="mb-1 font-semibold">{row.name}</h6>
                {row.productCode && (
                    <div className="mb-2 text-sm text-gray-500 dark:text-gray-300">
                        {row.productCode}
                    </div>
                )}
                {detailKeys.map((key, i) => (
                    <div key={key + i} className="mb-1 text-sm">
                        <span className="capitalize text-gray-500 dark:text-gray-400">
                            {key}:{' '}
                        </span>
                        {details[key]?.map((item, j) => (
                            <Fragment key={`${item}${j}`}>
                                <span className="font-medium text-gray-800 dark:text-gray-100">
                                    {item}
                                </span>
                                {!isLastChild(details[key], j) && <span>, </span>}
                            </Fragment>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

const ContentTable = ({
    products = [],
    summary = {},
    orderCurrency,
    fxSnapshot,
    resource,
}: ContentTableProps) => {
    const { t, i18n } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const preferredCurrency =
        normalizeCurrencyCode(orderCurrency, storeCurrency) ||
        normalizeCurrencyCode(storeCurrency, 'UYU') ||
        'UYU'
    const summaryCurrency =
        normalizeCurrencyCode(summary.currency, preferredCurrency) ||
        preferredCurrency

    const formatAmount = useMemo(
        () => (value?: number, currency?: string) =>
            formatCurrency(value, currency ?? summaryCurrency, i18n.language, {
                fallbackCurrency: preferredCurrency,
            }),
        [i18n.language, preferredCurrency, summaryCurrency],
    )

    const showSpecifications = true

    const translateSpecKey = useCallback(
        (key: string) => {
            const normalized = key.trim().toLowerCase()
            if (normalized === 'width') {
                return t('text.specs.width', {
                    defaultValue: formatSpecKey(key),
                })
            }
            if (normalized === 'height') {
                return t('text.specs.height', {
                    defaultValue: formatSpecKey(key),
                })
            }
            if (normalized === 'length') {
                return t('text.specs.length', {
                    defaultValue: formatSpecKey(key),
                })
            }
            return formatSpecKey(key)
        },
        [t],
    )

    const measurementFormatter = useMemo(
        () =>
            new Intl.NumberFormat(i18n.language, {
                minimumFractionDigits: Math.min(2, MAX_MEASUREMENT_DECIMALS),
                maximumFractionDigits: MAX_MEASUREMENT_DECIMALS,
                useGrouping: false,
            }),
        [i18n.language],
    )

    const formatMeasurementValue = useCallback(
        (value: number) => {
            if (!Number.isFinite(value)) {
                return undefined
            }
            const precisionFactor = 10 ** MAX_MEASUREMENT_DECIMALS
            const rounded = Math.round(value * precisionFactor) / precisionFactor
            return measurementFormatter.format(rounded)
        },
        [measurementFormatter],
    )

    const formatAttributeValue = useCallback<FormatAttributeValue>(
        (_key, value, normalizedKey) => {
            if (value === null || value === undefined) {
                return undefined
            }
            const resolveText = () => {
                if (typeof value === 'string') {
                    return value.trim()
                }
                if (typeof value === 'number') {
                    return value.toString()
                }
                if (
                    typeof value === 'object' &&
                    value &&
                    'toString' in value &&
                    typeof value.toString === 'function'
                ) {
                    const text = (
                        value as { toString: () => string }
                    ).toString().trim()
                    return text === '[object Object]' ? '' : text
                }
                return ''
            }
            const rawText = resolveText()
            if (!rawText) {
                return undefined
            }
            const numeric = (() => {
                if (typeof value === 'number') {
                    return Number.isFinite(value) ? value : undefined
                }
                const normalized = rawText.replace(/\s+/g, '').replace(',', '.')
                if (!normalized) {
                    return undefined
                }
                const parsed = Number(normalized)
                return Number.isFinite(parsed) ? parsed : undefined
            })()
            if (numeric !== undefined) {
                const formatted = formatMeasurementValue(numeric)
                if (!formatted) {
                    return undefined
                }
                if (SPEC_KEY_PRIORITY[normalizedKey] !== undefined) {
                    return `${formatted} m`
                }
                return formatted
            }
            return rawText
        },
        [formatMeasurementValue],
    )

    const tableColumns = useMemo(() => {
        const productColumn = columnHelper.accessor('name', {
            header: t('text.columns.product'),
            cell: (props) => {
                const row = props.row.original
                return <ProductColumn row={row} />
            },
        })
        const quantityColumn = columnHelper.accessor('quantity', {
            header: t('text.columns.quantity'),
            cell: (props) => {
                const row = props.row.original
                const rawQuantity = resolveRawQuantity(row)
                if (rawQuantity !== undefined && Number.isFinite(rawQuantity)) {
                    return rawQuantity
                }
                const unit = resolveSalesUnit(
                    row.unitOfMeasure,
                    row.pricingMethod,
                )
                const derivedQuantity =
                    row.effectiveQuantity ??
                    getEffectiveQuantity({
                        qty: row.quantity ?? row.qty,
                        unitOfMeasure: row.unitOfMeasure,
                        pricingMethod: row.pricingMethod,
                        customAttributes: row.customAttributes,
                    })
                if (!Number.isFinite(derivedQuantity)) {
                    return '—'
                }
                if (unit === 'UNIT') {
                    return derivedQuantity
                }
                const measurementSuffix =
                    unit === 'SQUARE_METER'
                        ? 'm²'
                        : unit === 'LINEAR_METER'
                        ? 'm'
                        : ''
                return (
                    <span>
                        {derivedQuantity.toFixed(2)}
                        {measurementSuffix ? ` ${measurementSuffix}` : ''}
                    </span>
                )
            },
        })
        const priceColumn = columnHelper.accessor('price', {
            header: t('text.columns.price'),
            cell: (props) => {
                const row = props.row.original
                const displayCurrency = summaryCurrency
                const baseUnitPrice = resolvePriceInOrderCurrency(
                    row,
                    displayCurrency,
                    fxSnapshot,
                )
                const derivedPrice = getDerivedUnitPrice({
                    unitPrice: baseUnitPrice,
                    unitOfMeasure: row.unitOfMeasure,
                    pricingMethod: row.pricingMethod,
                    customAttributes: row.customAttributes,
                })
                return (
                    <span>{formatAmount(derivedPrice, displayCurrency)}</span>
                )
            },
        })
        const commentsColumn = columnHelper.accessor('comments', {
            header: t('text.columns.comments'),
            cell: (props) => {
                const value = props.row.original.comments
                const text =
                    typeof value === 'string' && value.trim().length > 0
                        ? value
                        : '—'
                return (
                    <span
                        className="whitespace-pre-wrap"
                        dir={resolveTextDirection(text)}
                    >
                        {text}
                    </span>
                )
            },
        })
        const totalColumn = columnHelper.display({
            id: 'total',
            header: t('text.columns.total'),
            cell: (props) => {
                const row = props.row.original
                const displayCurrency = summaryCurrency
                const storedTotal = Number(row.total)
                if (Number.isFinite(storedTotal)) {
                    return (
                        <span>{formatAmount(storedTotal, displayCurrency)}</span>
                    )
                }
                const baseUnitPrice =
                    getNumeric(row.unitPrice) ??
                    resolvePriceInOrderCurrency(
                        row,
                        displayCurrency,
                        fxSnapshot,
                    )
                const computedTotal = calculateLineTotal({
                    unitPrice: baseUnitPrice,
                    qty: row.quantity,
                    unitOfMeasure: row.unitOfMeasure,
                    pricingMethod: row.pricingMethod,
                    customAttributes: row.customAttributes,
                })
                return (
                    <span>{formatAmount(computedTotal, displayCurrency)}</span>
                )
            },
        })

        const columns = [productColumn, quantityColumn]

        if (showSpecifications) {
            columns.push(
                columnHelper.display({
                    id: 'specifications',
                    header: t('text.columns.specifications', {
                        defaultValue: 'Specifications',
                    }),
                    cell: (props) => {
                        const row = props.row.original
                        const summaryText = resolveSpecifications(row, {
                            translateKey: translateSpecKey,
                            formatAttributeValue,
                            skipSpecSummaryIfCustomAttributes: true,
                        })
                        const display =
                            summaryText && summaryText.trim().length > 0
                                ? summaryText
                                : '—'
                        return (
                            <span
                                className="whitespace-pre-wrap"
                                dir={resolveTextDirection(display)}
                            >
                                {display}
                            </span>
                        )
                    },
                }),
            )
        }

        columns.push(commentsColumn)
        columns.push(priceColumn)
        columns.push(totalColumn)

        return columns
    }, [
        fxSnapshot,
        formatAmount,
        formatAttributeValue,
        showSpecifications,
        summaryCurrency,
        t,
        translateSpecKey,
    ])

    const table = useReactTable({
        data: products,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
    })
    const summaryLeadingColSpan = Math.max(
        table.getVisibleLeafColumns().length - 2,
        0,
    )

    const taxLabel =
        typeof summary.taxRate === 'number'
            ? t('text.labels.taxWithRate', { rate: summary.taxRate })
            : t('text.labels.tax')

    const formatSummaryValue = useMemo(
        () => (value?: number) => formatAmount(value, summaryCurrency),
        [formatAmount, summaryCurrency],
    )

    return (
        <Table>
            <THead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <Tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <Th key={header.id} colSpan={header.colSpan}>
                                {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                )}
                            </Th>
                        ))}
                    </Tr>
                ))}
            </THead>
            <TBody>
                {table.getRowModel().rows.map((row) => (
                    <Tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <Td key={cell.id}>
                                {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                )}
                            </Td>
                        ))}
                    </Tr>
                ))}
            </TBody>
            <TFoot>
                <Tr>
                    {summaryLeadingColSpan > 0 && (
                        <Td className="border-t-0!" colSpan={summaryLeadingColSpan}></Td>
                    )}
                    <Td className="font-semibold border-t-0!">
                        {t('text.labels.subtotal')}
                    </Td>
                    <Td className="py-5! border-t-0!">
                        {formatSummaryValue(summary.subTotal)}
                    </Td>
                </Tr>
                <Tr>
                    {summaryLeadingColSpan > 0 && (
                        <Td className="border-t-0!" colSpan={summaryLeadingColSpan}></Td>
                    )}
                    <Td className="font-semibold border-t-0!">
                        {t('text.labels.deliveryFee')}
                    </Td>
                    <Td className="py-5! border-t-0!">
                        {formatSummaryValue(summary.deliveryFees)}
                    </Td>
                </Tr>
                <Tr>
                    {summaryLeadingColSpan > 0 && (
                        <Td className="border-t-0!" colSpan={summaryLeadingColSpan}></Td>
                    )}
                    <Td className="font-semibold border-t-0!">
                        {taxLabel}
                    </Td>
                    <Td className="py-5! border-t-0!">
                        {formatSummaryValue(summary.tax)}
                    </Td>
                </Tr>
                <Tr>
                    {summaryLeadingColSpan > 0 && (
                        <Td className="border-t-0!" colSpan={summaryLeadingColSpan}></Td>
                    )}
                    <Td className="font-semibold text-base">
                        {t('text.labels.grandTotal')}
                    </Td>
                    <Td className="py-5! font-semibold text-base">
                        {formatSummaryValue(summary.total)}
                    </Td>
                </Tr>
            </TFoot>
        </Table>
    )
}

export default ContentTable
