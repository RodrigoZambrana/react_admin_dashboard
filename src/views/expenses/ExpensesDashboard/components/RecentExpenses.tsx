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

type Expense = {
    id: string
    date: number
    vendor: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    amount: number
}

type RecentExpensesProps = {
    data?: Expense[]
    className?: string
}

type ExpenseColumnPros = {
    row: Expense
}

const { Tr, Td, TBody, THead, Th } = Table

const statusColor: Record<
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

const ExpenseColumn = ({ row }: ExpenseColumnPros) => {
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()

    const onView = useCallback(() => {
        navigate(`/app/expenses/expense-edit/${row.id}`)
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

const columnHelper = createColumnHelper<Expense>()

const columns = (t: (key: string, opts?: any) => string) => [
    columnHelper.accessor('id', {
        header: t('expenses.latestExpenses.columns.expense'),
        cell: (props) => <ExpenseColumn row={props.row.original} />,
    }),
    columnHelper.accessor('date', {
        header: t('text.columns.date'),
        cell: (props) => {
            const row = props.row.original
            return <span>{dayjs.unix(row.date).format('DD/MM/YYYY')}</span>
        },
    }),
    columnHelper.accessor('vendor', {
        header: t('expenses.latestExpenses.columns.vendor'),
    }),
    columnHelper.accessor('amount', {
        header: t('text.columns.amount'),
        cell: (props) => {
            const { amount } = props.row.original
            return (
                <NumericFormat
                    displayType="text"
                    value={(Math.round(amount * 100) / 100).toFixed(2)}
                    prefix={'$'}
                    thousandSeparator={true}
                />
            )
        },
    }),
]

const RecentExpenses = ({ data = [], className }: RecentExpensesProps) => {
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
                <h4>{t('expenses.dashboard.latestExpenses.title')}</h4>
                <Button size="sm" onClick={() => navigate('/app/expenses/expense-list')}>
                    {t('expenses.dashboard.latestExpenses.viewExpenses')}
                </Button>
            </div>
            <Table>
                <THead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <Th key={header.id} colSpan={header.colSpan}>
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

export default RecentExpenses
