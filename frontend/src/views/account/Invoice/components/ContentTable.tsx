import { Fragment, useMemo } from 'react'
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

export type Product = {
    id: string
    name: string
    productCode?: string
    img?: string
    price?: number
    quantity?: number
    total?: number
    currency?: string
    unitCurrency?: string
    unitAmount?: number
    unitAmountOrderCurrency?: number
    conversionRate?: number
    details?: Record<string, string[]>
    comments?: string
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
}

const { Tr, Th, Td, THead, TBody, TFoot } = Table

const columnHelper = createColumnHelper<Product>()

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

    const tableColumns = useMemo(
        () => [
            columnHelper.accessor('name', {
                header: t('text.columns.product'),
                cell: (props) => {
                    const row = props.row.original
                    return <ProductColumn row={row} />
                },
            }),
            columnHelper.accessor('price', {
                header: t('text.columns.price'),
                cell: (props) => {
                    const row = props.row.original
                    const displayCurrency = summaryCurrency
                    const resolvedPrice = resolvePriceInOrderCurrency(
                        row,
                        displayCurrency,
                        fxSnapshot,
                    )
                    return (
                        <span>{formatAmount(resolvedPrice, displayCurrency)}</span>
                    )
                },
            }),
            columnHelper.accessor('quantity', {
                header: t('text.columns.quantity'),
                cell: (props) => {
                    const quantity = getNumeric(props.row.original.quantity)
                    return quantity !== undefined ? quantity : '—'
                },
            }),
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
            columnHelper.display({
                id: 'total',
                header: t('text.columns.total'),
                cell: (props) => {
                    const row = props.row.original
                    const quantity = getNumeric(row.quantity) ?? 0
                    const displayCurrency = summaryCurrency
                    const price = resolvePriceInOrderCurrency(
                        row,
                        displayCurrency,
                        fxSnapshot,
                    )
                    const computedTotal = price * quantity
                    return (
                        <span>{formatAmount(computedTotal, displayCurrency)}</span>
                    )
                },
            }),
        ],
        [fxSnapshot, formatAmount, summaryCurrency, t],
    )

    const table = useReactTable({
        data: products,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
    })

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
                    <Td className="border-t-0!" colSpan={3}></Td>
                    <Td className="font-semibold border-t-0!">
                        {t('text.labels.subtotal')}
                    </Td>
                    <Td className="py-5! border-t-0!">
                        {formatSummaryValue(summary.subTotal)}
                    </Td>
                </Tr>
                <Tr>
                    <Td className="border-t-0!" colSpan={3}></Td>
                    <Td className="font-semibold border-t-0!">
                        {t('text.labels.deliveryFee')}
                    </Td>
                    <Td className="py-5! border-t-0!">
                        {formatSummaryValue(summary.deliveryFees)}
                    </Td>
                </Tr>
                <Tr>
                    <Td className="border-t-0!" colSpan={3}></Td>
                    <Td className="font-semibold border-t-0!">
                        {taxLabel}
                    </Td>
                    <Td className="py-5! border-t-0!">
                        {formatSummaryValue(summary.tax)}
                    </Td>
                </Tr>
                <Tr>
                    <Td className="border-t-0!" colSpan={3}></Td>
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
