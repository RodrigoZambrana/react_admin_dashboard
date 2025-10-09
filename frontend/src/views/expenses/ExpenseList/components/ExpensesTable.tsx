import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import Select from '@/components/ui/Select'
import { apiGetExpenseStatuses, apiGetPaymentMethods } from '@/services/SettingsService'
import { apiUpdateExpense } from '@/services/ExpensesService'
import Tooltip from '@/components/ui/Tooltip'
import DataTable from '@/components/shared/DataTable'
import { HiOutlineEye, HiOutlineTrash } from 'react-icons/hi'
import { NumericFormat } from 'react-number-format'
import classNames from 'classnames'
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
    categoryId?: number | null
    categoryName: string
    statusId?: number | null
    statusName: string
    statusColor?: string | null
    paymentMethodId?: number | null
    paymentMethodName: string
    paymentReference?: string
    amount: number
    note?: string
    currency?: string | null
}

const sortKeyMap: Record<string, string> = {
    id: 'id',
    date: 'date',
    vendor: 'vendor',
    title: 'vendor',
    category: 'category',
    categoryid: 'category',
    categoryname: 'category',
    status: 'status',
    statusid: 'status',
    statusname: 'status',
    paymentmethod: 'paymentMethod',
    paymentmethodid: 'paymentMethod',
    paymentmethodname: 'paymentMethod',
    amount: 'amount',
}

const normalizeSort = (
    s?: OnSortParam | { key?: string | number; order?: string } | null,
) => {
    if (!s) {
        return undefined
    }
    const rawKey = (s as any).key
    const keyString =
        rawKey === 0 || rawKey === '0'
            ? '0'
            : rawKey !== undefined && rawKey !== null
              ? String(rawKey).trim()
              : ''
    const mappedKey =
        keyString.length > 0 ? sortKeyMap[keyString.toLowerCase()] ?? keyString : ''
    const rawOrder = (s as any).order
    const normalizedOrder =
        rawOrder === 'ascend'
            ? 'asc'
            : rawOrder === 'descend'
              ? 'desc'
              : rawOrder === 'asc' || rawOrder === 'desc'
                ? rawOrder
                : ''
    if (!mappedKey || !normalizedOrder) {
        return undefined
    }
    return { key: mappedKey, order: normalizedOrder as 'asc' | 'desc' }
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
        { id: number; name: string; color: string | null }[]
    >([])
    const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([])

    const data = useAppSelector((state) => state.expensesList.data.expenses)
    const defaultCurrency = useAppSelector((state) => state.currency.code)

    const fetchData = useCallback(() => {
        const normalizedSort = normalizeSort(sort as any)
        dispatch(getExpensesList({ pageIndex, pageSize, sort: normalizedSort, query }))
    }, [dispatch, pageIndex, pageSize, query, sort])

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
        const fetchMethods = async () => {
            const mRes = await apiGetPaymentMethods<{ id: string; name: string }[]>()
            setPaymentMethods(
                (mRes.data as any[]).map((m) => ({
                    value: String(m.id),
                    label: m.name,
                })),
            )
        }
        fetchStatuses()
        fetchMethods()
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
                accessorKey: 'categoryName',
                cell: (props) => {
                    const row = props.row.original
                    return row.categoryName || '—'
                },
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'statusName',
                cell: (props) => {
                    const row = props.row.original
                    const selectedStatus = expenseStatuses.find(
                        (status) => status.id === row.statusId,
                    )
                    const options = expenseStatuses.map((status) => ({
                        value: String(status.id),
                        label: status.name,
                        color: status.color || '#6b7280',
                    }))
                    const fallbackStatus =
                        !selectedStatus && row.statusName
                            ? {
                                  value: String(row.statusId ?? 'current'),
                                  label: row.statusName,
                                  color: row.statusColor || '#6b7280',
                              }
                            : null
                    const onChange = async (opt: any) => {
                        const value = opt ? Number(opt.value) : null
                        await apiUpdateExpense<boolean, { id: string; statusId: number | null }>(
                            { id: row.id, statusId: value },
                        )
                        fetchData()
                    }
                    return (
                        <div className="min-w-[160px]">
                            <Select
                                size="sm"
                                options={options}
                                value={
                                    selectedStatus
                                        ? {
                                              value: String(selectedStatus.id),
                                              label: selectedStatus.name,
                                              color: selectedStatus.color || '#6b7280',
                                          }
                                        : fallbackStatus
                                }
                                onChange={onChange}
                                placeholder="—"
                                formatOptionLabel={(option, { context }: { context: 'menu' | 'value' }) => (
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-block h-2.5 w-2.5 rounded-full border border-gray-200 dark:border-gray-600"
                                            style={{ backgroundColor: option.color }}
                                        />
                                        <span
                                            className={classNames(
                                                'capitalize font-semibold',
                                                context === 'value' ? '' : '',
                                            )}
                                        >
                                            {option.label}
                                        </span>
                                    </div>
                                )}
                            />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.paymentMethod'),
                accessorKey: 'paymentMethodName',
                cell: (props) => {
                    const row = props.row.original
                    const current = row.paymentMethodId
                        ? paymentMethods.find(
                              (m) => m.value === String(row.paymentMethodId),
                          )
                        : null
                    const fallbackMethod =
                        !current && row.paymentMethodName
                            ? {
                                  value: String(row.paymentMethodId ?? 'current'),
                                  label: row.paymentMethodName,
                              }
                            : null
                    const onChange = async (opt: any) => {
                        const value = opt ? Number(opt.value) : null
                        await apiUpdateExpense<boolean, { id: string; paymentMethodId: number | null }>({
                            id: row.id,
                            paymentMethodId: value,
                        })
                        fetchData()
                    }
                    return (
                        <div className="min-w-[160px]">
                            <Select
                                size="md"
                                options={paymentMethods}
                                value={current || fallbackMethod}
                                onChange={onChange}
                                isClearable
                                placeholder="—"
                            />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.amount'),
                accessorKey: 'amount',
                cell: (props) => {
                    const { amount, currency: rowCurrency } = props.row.original
                    const currencyLabel = rowCurrency || defaultCurrency
                    return (
                        <NumericFormat
                            displayType="text"
                            value={(Math.round(amount * 100) / 100).toFixed(2)}
                            prefix={currencyLabel ? `${currencyLabel} ` : ''}
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
        [t, defaultCurrency, paymentMethods, expenseStatuses, fetchData],
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

    const onSort = (sortParam: OnSortParam) => {
        const normalized = normalizeSort(sortParam)
        const newTableData = cloneDeep(tableData)
        newTableData.sort = (normalized ?? { key: '', order: '' }) as any
        dispatch(setTableData(newTableData))
        dispatch(setSelectedRows([]))
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
