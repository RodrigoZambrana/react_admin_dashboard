import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Table from '@/components/ui/Table'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import isLastChild from '@/utils/isLastChild'
import { useAppSelector } from '@/store'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import type { FxSnapshot } from '@/adapters/sales'
import { resolveTextDirection } from '@/utils/textDirection'
import {
    calculateLineTotal,
    getEffectiveQuantity,
    resolveSalesUnit,
} from '@/utils/salesUnitCalculation'
import {
    computeSalesDocumentDisplayUnitPrice,
    resolveSalesDocumentUnitAmount,
} from '@/utils/salesDocumentPricing'
import { createSalesDocumentRounder } from '@/utils/salesDocumentCalculations'
import { useSalesDocumentI18n } from '../../context/useSalesDocumentI18n'
import { useSalesDocument } from '../../context/SalesDocumentContext'

type Product = {
    id: string
    productId?: string
    name: string
    productCode: string
    img: string
    price: number
    quantity: number
    qty?: number
    total: number
    currency?: string
    unitCurrency?: string
    unitAmount?: number
    unitAmountOrderCurrency?: number
    conversionRate?: number
    details: Record<string, string[]>
    comments?: string
    specSummary?: string
    specifications?: string
    customAttributes?: Record<string, unknown>
    unitOfMeasure?: string | null
    pricingMethod?: string | null
    effectiveQuantity?: number
    unitPrice?: number
}

type OrderProductsProps = {
    data?: Product[]
    orderCurrency?: string
    fxSnapshot?: FxSnapshot
}

const { Tr, Th, Td, THead, TBody } = Table

const columnHelper = createColumnHelper<Product>()

const ProductColumn = ({ row, showSku }: { row: Product; showSku: boolean }) => {
    const details = row.details ?? {}
    const detailKeys = Object.keys(details)
    return (
        <div>
            <h6 className="mb-1 font-semibold">{row.name}</h6>
            {showSku && row.productCode && (
                <div className="mb-2 text-sm text-gray-500 dark:text-gray-300">
                    {row.productCode}
                </div>
            )}
            {detailKeys.map((key, i) => (
                <div key={`${key}${i}`} className="mb-1 text-sm">
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
    )
}

const getNumeric = (value?: number | null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
}

const formatSpecKey = (key: string) =>
    key
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())

const resolveSpecifications = (row: Product) => {
    const parts: string[] = []
    if (typeof row.specSummary === 'string') {
        const trimmed = row.specSummary.trim()
        if (trimmed) {
            parts.push(trimmed)
        }
    }
    if (typeof row.specifications === 'string') {
        const trimmed = row.specifications.trim()
        if (trimmed) {
            parts.push(trimmed)
        }
    }
    const attrs = row.customAttributes
    if (!attrs || typeof attrs !== 'object') {
        return parts.join('\n') || undefined
    }
    const entries = Object.entries(attrs).filter(([, value]) => {
        if (value === null || value === undefined) {
            return false
        }
        const text = String(value).trim()
        return text.length > 0
    })
    if (!entries.length) {
        return parts.join('\n') || undefined
    }
    const attributesSummary = entries
        .map(([key, value]) => `${formatSpecKey(key)}: ${value}`)
        .join(', ')
    if (attributesSummary) {
        parts.push(attributesSummary)
    }
    return parts.join('\n') || undefined
}

const columns = (
    t: (k: string) => string,
    formatAmount: (value: number, currency?: string) => string,
    orderCurrency: string,
    defaultCurrency: string,
    fxSnapshot: FxSnapshot | undefined,
    roundAmount: (value: number) => number,
    options: { showSpecifications?: boolean; showSku?: boolean } = {},
) => {
    const showSpecifications = options.showSpecifications !== false
    const showSku = options.showSku === true
    const definition = [
        columnHelper.accessor('name', {
            header: t('text.columns.product'),
            cell: (props) => {
                const row = props.row.original
                return <ProductColumn row={row} showSku={showSku} />
            },
        }),
        columnHelper.accessor('quantity', {
            header: t('text.columns.quantity'),
            cell: (props) => {
                const row = props.row.original
                const unit = resolveSalesUnit(
                    row.unitOfMeasure,
                    row.pricingMethod,
                )
                const effectiveQuantity =
                    row.effectiveQuantity ??
                    getEffectiveQuantity({
                        qty: row.quantity,
                        unitOfMeasure: row.unitOfMeasure,
                        pricingMethod: row.pricingMethod,
                        customAttributes: row.customAttributes,
                    })
                const formattedQuantity = Number.isFinite(effectiveQuantity)
                    ? effectiveQuantity.toFixed(2)
                    : '0.00'
                if (unit === 'UNIT') {
                    return <span>{Number(row.quantity) || 0}</span>
                }
                const measurementSuffix =
                    unit === 'SQUARE_METER'
                        ? 'm²'
                        : unit === 'LINEAR_METER'
                        ? 'm'
                        : ''
                return (
                    <span>
                        {formattedQuantity}
                        {measurementSuffix ? ` ${measurementSuffix}` : ''}
                    </span>
                )
            },
        }),
    ]

    if (showSpecifications) {
        definition.push(
            columnHelper.display({
                id: 'specifications',
                header: t('text.columns.specifications', {
                    defaultValue: 'Especificaciones',
                }),
                cell: (props) => {
                    const row = props.row.original
                    const summary = resolveSpecifications(row)
                    return (
                        <span
                            className="whitespace-pre-wrap"
                            dir={resolveTextDirection(summary)}
                        >
                            {summary || '—'}
                        </span>
                    )
                },
            }),
        )
    }

    definition.push(
        columnHelper.accessor('comments', {
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
                        dir={resolveTextDirection(value)}
                    >
                        {text}
                    </span>
                )
            },
        }),
        columnHelper.accessor('price', {
            header: t('text.columns.price'),
            cell: (props) => {
                const row = props.row.original
                const displayCurrency =
                    normalizeCurrencyCode(orderCurrency, defaultCurrency) ||
                    defaultCurrency
                const derivedPrice = computeSalesDocumentDisplayUnitPrice(
                    row,
                    displayCurrency,
                    fxSnapshot,
                )
                const roundedPrice = roundAmount(derivedPrice)
                return (
                    <span>
                        {formatAmount(roundedPrice, displayCurrency)}
                    </span>
                )
            },
        }),
        columnHelper.accessor('total', {
            header: t('text.columns.total'),
            cell: (props) => {
                const row = props.row.original
                const displayCurrency =
                    normalizeCurrencyCode(orderCurrency, defaultCurrency) || defaultCurrency
                const storedTotal = Number(row.total)
                if (Number.isFinite(storedTotal)) {
                    return (
                        <span>
                            {formatAmount(
                                roundAmount(storedTotal),
                                displayCurrency,
                            )}
                        </span>
                    )
                }
                const baseUnitPrice = resolveSalesDocumentUnitAmount(
                    row,
                    displayCurrency,
                    fxSnapshot,
                )
                const fallbackTotal = calculateLineTotal({
                    unitPrice: baseUnitPrice,
                    qty: row.quantity,
                    unitOfMeasure: row.unitOfMeasure,
                    pricingMethod: row.pricingMethod,
                    customAttributes: row.customAttributes,
                })
                return (
                    <span>
                        {formatAmount(
                            roundAmount(fallbackTotal),
                            displayCurrency,
                        )}
                    </span>
                )
            },
        }),
    )

    return definition
}

const OrderProducts = ({ data = [], orderCurrency, fxSnapshot }: OrderProductsProps) => {
    const { t, i18n } = useTranslation()
    const { mode } = useSalesDocument()
    const { showProductSpecifications } = useSalesDocumentI18n()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const normalizedOrderCurrency =
        normalizeCurrencyCode(orderCurrency, defaultCurrency) || defaultCurrency
    const roundAmount = useMemo(
        () => createSalesDocumentRounder(mode),
        [mode],
    )
    const formatAmount = (value: number, currency?: string) =>
        formatCurrency(value, currency, i18n.language, {
            fallbackCurrency: defaultCurrency,
        })
    const table = useReactTable({
        data,
        columns: columns(
            t,
            formatAmount,
            normalizedOrderCurrency,
            defaultCurrency,
            fxSnapshot,
            roundAmount,
            {
                showSpecifications: showProductSpecifications,
            },
        ),
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <AdaptableCard className="mb-4">
            <Table>
                <THead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <Th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )}
                                    </Th>
                                )
                            })}
                        </Tr>
                    ))}
                </THead>
                <TBody>
                    {table.getRowModel().rows.map((row) => {
                        return (
                            <Tr key={row.id}>
                                {row.getVisibleCells().map((cell) => {
                                    return (
                                        <Td key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </Td>
                                    )
                                })}
                            </Tr>
                        )
                    })}
                </TBody>
            </Table>
        </AdaptableCard>
    )
}

export default OrderProducts
