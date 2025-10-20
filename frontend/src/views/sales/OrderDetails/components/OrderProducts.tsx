import { Fragment } from 'react'
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
import { convertAmountWithSnapshot } from '@/utils/fxConversion'
import { resolveTextDirection } from '@/utils/textDirection'

type Product = {
    id: string
    productId?: string
    name: string
    productCode: string
    img: string
    price: number
    quantity: number
    total: number
    currency?: string
    unitCurrency?: string
    unitAmount?: number
    unitAmountOrderCurrency?: number
    conversionRate?: number
    details: Record<string, string[]>
    comments?: string
}

type OrderProductsProps = {
    data?: Product[]
    orderCurrency?: string
    fxSnapshot?: FxSnapshot
}

const { Tr, Th, Td, THead, TBody } = Table

const columnHelper = createColumnHelper<Product>()

const ProductColumn = ({ row }: { row: Product }) => {
    const details = row.details ?? {}
    const detailKeys = Object.keys(details)
    return (
        <div>
            <h6 className="mb-1 font-semibold">{row.name}</h6>
            {row.productCode && (
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

const resolvePriceInOrderCurrency = (
    row: Product,
    orderCurrency: string,
    fxSnapshot?: FxSnapshot,
) => {
    const explicitPrice = getNumeric(row.price)
    if (explicitPrice !== undefined) {
        return explicitPrice
    }
    const orderUnitAmount = getNumeric(row.unitAmountOrderCurrency)
    if (orderUnitAmount !== undefined) {
        return orderUnitAmount
    }
    const unitAmount = getNumeric(row.unitAmount)
    const unitCurrency =
        normalizeCurrencyCode(row.unitCurrency, orderCurrency) || orderCurrency
    if (unitAmount !== undefined && unitCurrency) {
        const converted = convertAmountWithSnapshot(unitAmount, unitCurrency, orderCurrency, fxSnapshot)
        if (converted !== undefined) {
            return converted
        }
        if (Number.isFinite(row.conversionRate) && row.conversionRate) {
            return unitAmount * Number(row.conversionRate)
        }
    }
    return 0
}

const columns = (
    t: (k: string) => string,
    formatAmount: (value: number, currency?: string) => string,
    orderCurrency: string,
    defaultCurrency: string,
    fxSnapshot?: FxSnapshot,
) => [
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
            const displayCurrency =
                normalizeCurrencyCode(orderCurrency, defaultCurrency) ||
                defaultCurrency
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
    columnHelper.accessor('total', {
        header: t('text.columns.total'),
        cell: (props) => {
            const row = props.row.original
            const displayCurrency =
                normalizeCurrencyCode(orderCurrency, defaultCurrency) || defaultCurrency
            const price = resolvePriceInOrderCurrency(
                row,
                displayCurrency,
                fxSnapshot,
            )
            const total = price * (Number(row.quantity) || 0)
            return (
                <span>{formatAmount(total, displayCurrency)}</span>
            )
        },
    }),
]

const OrderProducts = ({ data = [], orderCurrency, fxSnapshot }: OrderProductsProps) => {
    const { t, i18n } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const normalizedOrderCurrency =
        normalizeCurrencyCode(orderCurrency, defaultCurrency) || defaultCurrency
    const formatAmount = (value: number, currency?: string) =>
        formatCurrency(value, currency, i18n.language, {
            fallbackCurrency: defaultCurrency,
        })
    const table = useReactTable({
        data,
        columns: columns(t, formatAmount, normalizedOrderCurrency, defaultCurrency, fxSnapshot),
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
