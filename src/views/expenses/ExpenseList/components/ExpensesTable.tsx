import { useEffect, useCallback, useMemo, useRef } from 'react'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { apiGetExpenseStatuses } from '@/services/SettingsService'
import { apiUpdateExpense } from '@/services/ExpensesService'
import { useState } from 'react'
import Tooltip from '@/components/ui/Tooltip'
import DataTable from '@/components/shared/DataTable'
import { HiOutlineEye, HiOutlineTrash } from 'react-icons/hi'
import { NumericFormat } from 'react-number-format'
import {
    setSelectedRows,
    addRowItem,
    removeRowItem,
    setDeleteMode,
    setSelectedRow,
    getExpensesList,
    setTableData,
    useAppDispatch,
    useAppSelector,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import cloneDeep from 'lodash/cloneDeep'
import dayjs from 'dayjs'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
    Row,
} from '@/components/shared/DataTable'

type Expense = {
    id: string
    date: number
    vendor: string
    category: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    amount: number
}

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

const ExpenseIdColumn = ({ row }: { row: Expense }) => {
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

const ActionColumn = ({ row }: { row: Expense }) => {
    const dispatch = useAppDispatch()
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const onDelete = () => {
        dispatch(setDeleteMode('single'))
        dispatch(setSelectedRow([row.id]))
    }

    const onView = useCallback(() => {
        navigate(`/app/expenses/expense-edit/${row.id}`)
    }, [navigate, row])

    return (
        <div className="flex justify-end text-lg">
            <Tooltip title={t('text.actions.view')}>
                <span
                    className={`cursor-pointer p-2 hover:${textTheme}`}
                    onClick={onView}
                >
                    <HiOutlineEye />
                </span>
            </Tooltip>
            <Tooltip title={t('text.actions.delete')}>
                <span
                    className="cursor-pointer p-2 hover:text-red-500"
                    onClick={onDelete}
                >
                    <HiOutlineTrash />
                </span>
            </Tooltip>
        </div>
    )
}

const ExpensesTable = () => {
    const tableRef = useRef<DataTableResetHandle>(null)

    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const { pageIndex, pageSize, sort, query, total } = useAppSelector(
        (state) => state.expensesList.data.tableData,
    )
    const loading = useAppSelector((state) => state.expensesList.data.loading)
    const [expenseStatuses, setExpenseStatuses] = useState<
        { id: number; name: string; color: string }[]
    >([
        { id: 0, name: 'Pagado', color: 'emerald-500' },
        { id: 1, name: 'Pendiente', color: 'amber-500' },
        { id: 2, name: 'Cancelado', color: 'red-500' },
    ])

    const data = useAppSelector((state) => state.expensesList.data.expenses)
    const currency = useAppSelector((state) => state.currency.code)

    const fetchData = useCallback(() => {
        dispatch(getExpensesList({ pageIndex, pageSize, sort, query }))
    }, [dispatch, pageIndex, pageSize, sort, query])

    useEffect(() => {
        dispatch(setSelectedRows([]))
        fetchData()
    }, [dispatch, fetchData, pageIndex, pageSize, sort])

    useEffect(() => {
        const fetchStatuses = async () => {
            const res = await apiGetExpenseStatuses<
                { id: number | string; name: string; color: string }[]
            >()
            const normalized = (res.data as any[]).map((s) => ({
                ...s,
                id: Number(s.id),
            }))
            if (normalized.length) setExpenseStatuses(normalized as any)
        }
        fetchStatuses()
    }, [])

    useEffect(() => {
        if (tableRef) {
            tableRef.current?.resetSelected()
        }
    }, [data])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total }),
        [pageIndex, pageSize, sort, query, total],
    )

    const columns: ColumnDef<Expense>[] = useMemo(
        () => [
            {
                header: t('expenses.list.columns.expense'),
                accessorKey: 'id',
                cell: (props) => <ExpenseIdColumn row={props.row.original} />,
            },
            {
                header: t('text.columns.date'),
                accessorKey: 'date',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <span>{dayjs.unix(row.date).format('DD/MM/YYYY')}</span>
                    )
                },
            },
            {
                header: t('expenses.list.columns.vendor'),
                accessorKey: 'vendor',
            },
            {
                header: t('text.columns.category'),
                accessorKey: 'category',
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const statusId =
                        typeof (row as any).status === 'string'
                            ? parseInt((row as any).status as unknown as string, 10)
                            : (row as any).status
                    const s = expenseStatuses.find((x) => x.id === statusId)
                    const options = expenseStatuses.map((x) => ({
                        value: x.id,
                        label: x.name,
                        color: x.color,
                    }))
                    const onChange = async (opt: any) => {
                        await apiUpdateExpense<boolean, { id: string; status: number }>(
                            { id: row.id, status: opt.value },
                        )
                        fetchData()
                    }
                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{ value: s?.id ?? statusId, label: s?.name ?? String(statusId), color: s?.color ?? 'gray-500' } as any}
                                formatOptionLabel={(option: any, { context }: { context: 'menu' | 'value' }) => (
                                    <div className="flex items-center">
                                        <span className={`badge-dot bg-${option.color}`}></span>
                                        <span className={`ml-2 rtl:mr-2 capitalize font-semibold ${context === 'value' ? `text-${option.color}` : ''}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                )}
                                style={{
                                    singleValue: (provided: any) => ({ ...provided, display: 'flex', alignItems: 'center' }),
                                    valueContainer: (provided: any) => ({ ...provided, display: 'flex', alignItems: 'center' }),
                                }}
                                onChange={onChange}
                            />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.paymentMethod'),
                accessorKey: 'paymentMehod',
                cell: (props) => {
                    const { paymentMehod, paymentIdendifier } =
                        props.row.original
                    return (
                        <span className="flex items-center">
                            <span className="ltr:ml-2 rtl:mr-2">
                                {paymentMehod.toUpperCase()} {paymentIdendifier}
                            </span>
                        </span>
                    )
                },
            },
            {
                header: t('text.columns.amount'),
                accessorKey: 'amount',
                cell: (props) => {
                    const { amount } = props.row.original
                    return (
                        <NumericFormat
                            displayType="text"
                            value={(Math.round(amount * 100) / 100).toFixed(2)}
                            prefix={`${currency} `}
                            thousandSeparator={true}
                        />
                    )
                },
            },
            {
                header: '',
                id: 'action',
                cell: (props) => <ActionColumn row={props.row.original} />,
            },
        ],
        [t, currency],
    )

    const onPaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        dispatch(setTableData(newTableData))
    }

    const onSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        dispatch(setTableData(newTableData))
    }

    const onSort = (sort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = sort
        dispatch(setTableData(newTableData))
    }

    const onRowSelect = (checked: boolean, row: Expense) => {
        if (checked) {
            dispatch(addRowItem([row.id]))
        } else {
            dispatch(removeRowItem(row.id))
        }
    }

    const onAllRowSelect = useCallback(
        (checked: boolean, rows: Row<Expense>[]) => {
            if (checked) {
                const originalRows = rows.map((row) => row.original)
                const selectedIds: string[] = []
                originalRows.forEach((row) => {
                    selectedIds.push(row.id)
                })
                dispatch(setSelectedRows(selectedIds))
            } else {
                dispatch(setSelectedRows([]))
            }
        },
        [dispatch],
    )

    return (
        <DataTable
            ref={tableRef}
            selectable
            columns={columns}
            data={data}
            loading={loading}
            pagingData={{
                total: tableData.total as number,
                pageIndex: tableData.pageIndex as number,
                pageSize: tableData.pageSize as number,
            }}
            onPaginationChange={onPaginationChange}
            onSelectChange={onSelectChange}
            onSort={onSort}
            onCheckBoxChange={onRowSelect}
            onIndeterminateCheckBoxChange={onAllRowSelect}
        />
    )
}

export default ExpensesTable
