import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    createColumnHelper,
} from '@tanstack/react-table'
import { CustomerOrder } from '../store'
import { useSelector } from 'react-redux'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'

const { Tr, Th, Td, THead, TBody, Sorter } = Table

const statusColor: Record<string, string> = {
    completed: 'bg-emerald-500',
    fulfilled: 'bg-emerald-500',
    paid: 'bg-emerald-500',
    pending: 'bg-amber-400',
    processing: 'bg-blue-400',
    cancelled: 'bg-red-400',
}

const columnHelper = createColumnHelper<CustomerOrder>()

const columns = (
    t: (k: string) => string,
    formatAmount: (value?: number, currency?: string) => string,
) => [
    columnHelper.accessor('id', {
        header: t('text.columns.reference'),
        cell: (props) => {
            const row = props.row.original
            return (
                <Link
                    to={`/app/sales/order-details/${row.id}`}
                    className="text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
                >
                    #{row.id}
                </Link>
            )
        },
    }),
    columnHelper.accessor('status', {
        header: t('text.columns.status'),
        cell: (props) => {
            const row = props.row.original
            const key = row.status?.toLowerCase?.() || row.status
            const badge = statusColor[key] || 'bg-gray-400'
            return (
                <div className="flex items-center">
                    <Badge className={badge} />
                    <span className="ml-2 rtl:mr-2 capitalize">
                        {t(`text.status.${key}`, { defaultValue: row.status })}
                    </span>
                </div>
            )
        },
    }),
    columnHelper.accessor('date', {
        header: t('text.columns.date'),
        cell: (props) => {
            const row = props.row.original
            return (
                <span>{dayjs.unix(row.date).format('MM/DD/YYYY')}</span>
            )
        },
    }),
    columnHelper.accessor('amount', {
        header: t('text.columns.amount'),
        cell: (props) => {
            const row = props.row.original
            return (
                <span>
                    {formatAmount(row.amount, row.currency)}
                </span>
            )
        },
    }),
    columnHelper.display({
        id: 'actions',
        header: t('text.columns.actions'),
        cell: (props) => {
            const row = props.row.original
            return (
                <div className="flex justify-end">
                    <Link to={`/app/sales/order-details/${row.id}`}>
                        <Button size="xs" variant="twoTone">
                            {t('text.actions.view')}
                        </Button>
                    </Link>
                </div>
            )
        },
    }),
]

const OrdersHistory = () => {
    const EMPTY_ORDERS: CustomerOrder[] = []
    const crmDetails = useSelector(
        (state: any) => state.crmCustomerDetails?.data,
    )
    const activityDetails = useSelector(
        (state: any) => state.calendarActivityDetails?.data,
    )
    const data =
        (crmDetails?.ordersData?.length ?? 0) > 0
            ? crmDetails.ordersData
            : activityDetails?.ordersData ?? EMPTY_ORDERS

    const [sorting, setSorting] = useState<
        {
            id: string
            desc: boolean
        }[]
    >([])

    const { t, i18n } = useTranslation()
    const storeCurrency = useSelector(
        (state: any) => state.currency?.code,
    )
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const formatAmount = (value?: number, currency?: string) =>
        formatCurrency(value, currency, i18n.language, {
            fallbackCurrency: defaultCurrency,
        })
    const table = useReactTable({
        data,
        columns: columns(t, formatAmount),
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <div className="mb-0">
            <h6 className="mb-4">{t('text.titles.orderHistory')}</h6>
            <Table>
                <THead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <Th key={header.id} colSpan={header.colSpan}>
                                    {header.isPlaceholder ? null : (
                                        <div
                                            className={
                                                header.column.getCanSort()
                                                    ? 'cursor-pointer select-none'
                                                    : ''
                                            }
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                            <Sorter sort={header.column.getIsSorted()} />
                                        </div>
                                    )}
                                </Th>
                            ))}
                        </Tr>
                    ))}
                </THead>
                <TBody>
                    {table
                        .getRowModel()
                        .rows.slice(0, 10)
                        .map((row) => (
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
            </Table>
        </div>
    )
}

export default OrdersHistory
