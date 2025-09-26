import { useCallback } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import useThemeClass from '@/utils/hooks/useThemeClass'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { NumericFormat } from 'react-number-format'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

type Order = {
    id: string
    date: number
    customer: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
}

type LatestOrderProps = {
    data?: Order[]
    className?: string
}

type OrderColumnPros = {
    row: Order
}

const { Tr, Td, TBody, THead, Th } = Table

const orderStatusColor: Record<
    number,
    {
        dotClass: string
        textClass: string
    }
> = {
    0: {
        dotClass: 'bg-emerald-500',
        textClass: 'text-emerald-500',
    },
    1: {
        dotClass: 'bg-amber-500',
        textClass: 'text-amber-500',
    },
    2: { dotClass: 'bg-red-500', textClass: 'text-red-500' },
}

const OrderColumn = ({ row }: OrderColumnPros) => {
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()

    const onView = useCallback(() => {
        navigate(`/app/sales/order-details/${row.id}`)
    }, [navigate, row])

    return (
        <span
            className={`cursor-pointer select-none font-semibold hover:${textTheme}`}
            onClick={onView}
        >
            #{row.id}
        </span>
    )
}

const columnHelper = createColumnHelper<Order>()

const columns = (t: (k: string) => string) => [
    columnHelper.accessor('id', {
        header: t('text.columns.order'),
        cell: (props) => <OrderColumn row={props.row.original} />,
    }),
    columnHelper.accessor('status', {
        header: t('text.columns.status'),
        cell: (props) => {
            const { status } = props.row.original
            return (
                <div className="flex items-center">
                    <Badge className={orderStatusColor[status].dotClass} />
                    <span
                        className={`ml-2 rtl:mr-2 capitalize font-semibold ${orderStatusColor[status].textClass}`}
                    >
                        {status === 0
                            ? t('text.status.paid')
                            : status === 1
                            ? t('text.status.pending')
                            : t('text.status.failed')}
                    </span>
                </div>
            )
        },
    }),
    columnHelper.accessor('date', {
        header: t('text.columns.date'),
        cell: (props) => {
            const row = props.row.original
            return <span>{dayjs.unix(row.date).format('DD/MM/YYYY')}</span>
        },
    }),
    columnHelper.accessor('customer', {
        header: t('text.columns.customer'),
    }),
    columnHelper.accessor('totalAmount', {
        header: t('text.columns.total'),
        cell: (props) => {
            const { totalAmount } = props.row.original
            return (
                <NumericFormat
                    displayType="text"
                    value={(Math.round(totalAmount * 100) / 100).toFixed(2)}
                    prefix={'$'}
                    thousandSeparator={true}
                />
            )
        },
    }),
]

const LatestOrder = ({ data = [], className }: LatestOrderProps) => {
    const { t } = useTranslation()
    const table = useReactTable({
        data,
        columns: columns(t),
        getCoreRowModel: getCoreRowModel(),
    })

    const navigate = useNavigate()

    return (
        <Card className={className}>
            <div className="flex items-center justify-between mb-6">
                <h4>{t('sales.dashboard.latestOrders.title')}</h4>
                <Button size="sm" onClick={() => navigate('/app/sales/order-list')}>
                    {t('sales.dashboard.latestOrders.viewOrders')}
                </Button>
            </div>
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
        </Card>
    )
}

export default LatestOrder
