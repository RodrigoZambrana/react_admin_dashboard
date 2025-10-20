import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import Select from '@/components/ui/Select'
import Tooltip from '@/components/ui/Tooltip'
import DataTable from '@/components/shared/DataTable'
import { HiOutlineDocumentText, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi'
import { NumericFormat } from 'react-number-format'
import {
    setSelectedRows,
    addRowItem,
    removeRowItem,
    setDeleteMode,
    setSelectedRow,
    getOrders,
    setTableData,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { apiGetOrderStatuses, apiGetPaymentMethods } from '@/services/SettingsService'
import { apiUpdateSalesOrderStatus, apiUpdateSalesOrderPaymentMethod } from '@/services/SalesService'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import cloneDeep from 'lodash/cloneDeep'
import { normalizeCurrencyCode } from '@/utils/currency'
import dayjs from 'dayjs'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
    Row,
} from '@/components/shared/DataTable'
import type { StylesConfig } from 'react-select'

type Order = {
    id: string
    date: number
    customer: string
    status: number | string
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
    orderCurrency?: string
}

const sortKeyMap: Record<string, string> = {
    id: 'id',
    date: 'date',
    customer: 'customer',
    status: 'status',
    paymentMehod: 'paymentMehod', // 👈 tal cual back
    totalAmount: 'totalAmount',
}

const normalizeSort = (s?: OnSortParam | { key?: string; order?: string } | null) => {
    if (!s) return undefined
    const key = sortKeyMap[(s as any).key] ?? (s as any).key
    const raw = (s as any).order
    const order = raw === 'ascend' ? 'asc' : raw === 'descend' ? 'desc' : raw
    if (!key || !order) return undefined
    return { key, order: order as 'asc' | 'desc' }
}

const OrderColumn = ({ row }: { row: Order }) => {
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()
    const onView = useCallback(() => {
        navigate(`/app/sales/order-details/${row.id}`)
    }, [navigate, row])
    return (
        <span className={`cursor-pointer select-none font-semibold hover:${textTheme}`} onClick={onView}>
            #{row.id}
        </span>
    )
}

const ActionColumn = ({ row }: { row: Order }) => {
    const dispatch = useAppDispatch()
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const onDelete = () => {
        dispatch(setDeleteMode('single'))
        dispatch(setSelectedRow([row.id]))
    }
    const onView = useCallback(() => {
        navigate(`/app/sales/order-details/${row.id}`)
    }, [navigate, row])
    const onInvoice = useCallback(() => {
        navigate(`/app/account/invoice/${row.id}`)
    }, [navigate, row])
    return (
        <div className="flex justify-end text-lg">
            <Tooltip title={t('text.actions.view')}>
                <span className={`cursor-pointer p-2 hover:${textTheme}`} onClick={onView}>
                    <HiOutlineEye />
                </span>
            </Tooltip>
            <Tooltip title={t('text.titles.invoice')}>
                <span className={`cursor-pointer p-2 hover:${textTheme}`} onClick={onInvoice}>
                    <HiOutlineDocumentText />
                </span>
            </Tooltip>
            <Tooltip title={t('text.actions.delete')}>
                <span className="cursor-pointer p-2 hover:text-red-500" onClick={onDelete}>
                    <HiOutlineTrash />
                </span>
            </Tooltip>
        </div>
    )
}

const OrdersTable = () => {
    const tableRef = useRef<DataTableResetHandle>(null)

    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const { pageIndex, pageSize, sort, query, total } = useAppSelector(
        (state) => state.salesOrderList.data.tableData,
    )
    const loading = useAppSelector((state) => state.salesOrderList.data.loading)
    const data = useAppSelector((state) => state.salesOrderList.data.orderList)
    const storeCurrency = useAppSelector((state) => state.currency.code)

    // Mantener el último estado para callbacks estables
    const tableStateRef = useRef({ pageIndex, pageSize, sort, query })
    useEffect(() => {
        tableStateRef.current = { pageIndex, pageSize, sort, query }
    }, [pageIndex, pageSize, sort, query])

    const defaultOrderStatuses = useMemo(
        () => [
            { id: 0, name: 'Pagado', color: 'emerald-500' },
            { id: 1, name: 'Pendiente', color: 'amber-500' },
            { id: 2, name: 'Cancelado', color: 'red-500' },
        ],
        [],
    )
    const [statuses, setStatuses] = useState<{ id: number; name: string; color: string }[]>(defaultOrderStatuses)
    const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([])

    const fetchData = useCallback(() => {
        const normalized = normalizeSort(sort as any)
        dispatch(getOrders({ pageIndex, pageSize, sort: normalized, query }))
    }, [dispatch, pageIndex, pageSize, sort, query])

    useEffect(() => {
        dispatch(setSelectedRows([]))
        fetchData()
    }, [dispatch, fetchData, pageIndex, pageSize, sort])

    useEffect(() => {
        const fetchStatuses = async () => {
            const res = await apiGetOrderStatuses<{ id: number | string; name: string; color: string }[]>()
            const normalized = (res.data as any[]).map((s) => ({ ...s, id: Number(s.id) }))
            if (normalized.length) setStatuses(normalized)
        }
        fetchStatuses()
    }, [])

    useEffect(() => {
        const fetchPaymentMethods = async () => {
            const res = await apiGetPaymentMethods<{ id: number | string; name: string }[]>()
            const opts = (res.data as any[]).map((m) => ({ value: m.name, label: m.name }))
            setPaymentMethods(opts)
        }
        fetchPaymentMethods()
    }, [])

    useEffect(() => {
        tableRef.current?.resetSelected?.()
    }, [data])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total }),
        [pageIndex, pageSize, sort, query, total],
    )

    const selectStyles = useMemo<StylesConfig<any, false>>(
        () => ({
            valueContainer: (provided) => ({ ...provided, display: 'flex', alignItems: 'center' }),
            singleValue: (provided) => ({ ...provided, display: 'flex', alignItems: 'center' }),
        }),
        [],
    )

    const columns: ColumnDef<Order>[] = useMemo(
        () => [
            { header: t('text.columns.order'), accessorKey: 'id', cell: (p) => <OrderColumn row={p.row.original} /> },
            {
                header: t('text.columns.date'),
                accessorKey: 'date',
                cell: (p) => <span>{dayjs.unix(p.row.original.date).format('DD/MM/YYYY')}</span>,
            },
            { header: t('text.columns.customer'), accessorKey: 'customer' },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const statusId = typeof row.status === 'string' ? parseInt(row.status as any, 10) : (row.status as number)
                    const s = statuses.find((x) => x.id === statusId)
                    const options = statuses.map((x) => ({ value: x.id, label: x.name, color: x.color }))
                    const onChange = async (opt: any) => {
                        await apiUpdateSalesOrderStatus<boolean, { id: string; status: number }>({ id: row.id, status: opt.value })
                        const st = tableStateRef.current
                        dispatch(setSelectedRows([]))
                        dispatch(getOrders({ pageIndex: st.pageIndex, pageSize: st.pageSize, sort: normalizeSort(st.sort as any), query: st.query }))
                    }
                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{ value: s?.id ?? statusId, label: s?.name ?? String(statusId), color: s?.color ?? 'gray-500' } as any}
                                formatOptionLabel={(option: any) => (
                                    <div className="flex items-center">
                                        <span className={`badge-dot bg-${option.color}`}></span>
                                        <span className={`ml-2 rtl:mr-2 capitalize font-semibold text-${option.color}`}>{option.label}</span>
                                    </div>
                                )}
                                styles={selectStyles}
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
                    const row = props.row.original
                    const current =
                        paymentMethods.find((m) => m.value === row.paymentMehod) ||
                        (row.paymentMehod ? { value: row.paymentMehod, label: row.paymentMehod } : undefined)
                    const onChange = async (opt: any) => {
                        await apiUpdateSalesOrderPaymentMethod<boolean, { id: string; paymentMehod: string }>({
                            id: row.id,
                            paymentMehod: (opt as any)?.value ?? '',
                        })
                        const st = tableStateRef.current
                        dispatch(setSelectedRows([]))
                        dispatch(getOrders({ pageIndex: st.pageIndex, pageSize: st.pageSize, sort: normalizeSort(st.sort as any), query: st.query }))
                    }
                    return (
                        <div className="flex items-center min-w-[180px]">
                            <div className="w-[160px]">
                                <Select
                                    size="sm"
                                    options={paymentMethods}
                                    value={current as any}
                                    placeholder={t('settings.paymentMethods.title')}
                                    styles={selectStyles}
                                    onChange={onChange}
                                />
                            </div>
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.total'),
                accessorKey: 'totalAmount',
                cell: (props) => {
                    const { totalAmount, orderCurrency } = props.row.original
                    const normalizedCurrency = normalizeCurrencyCode(orderCurrency, storeCurrency)
                    return (
                        <NumericFormat
                            displayType="text"
                            value={(Math.round(totalAmount * 100) / 100).toFixed(2)}
                            prefix={normalizedCurrency ? `${normalizedCurrency} ` : ''}
                            thousandSeparator
                        />
                    )
                },
            },
            { header: '', id: 'action', enableSorting: false, cell: (p) => <ActionColumn row={p.row.original} /> },
        ],
        [t, statuses, paymentMethods, selectStyles, dispatch, storeCurrency],
    )

    const onPaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        dispatch(setTableData(newTableData))
        dispatch(setSelectedRows([]))
    }

    const onSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        dispatch(setTableData(newTableData))
        dispatch(setSelectedRows([]))
    }

    const onSort = (nextSort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = normalizeSort(nextSort) as any
        dispatch(setTableData(newTableData))
        dispatch(setSelectedRows([]))
    }

    const onRowSelect = (checked: boolean, row: Order) => {
        if (checked) dispatch(addRowItem([row.id]))
        else dispatch(removeRowItem(row.id))
    }

    const onAllRowSelect = useCallback(
        (checked: boolean, rows: Row<Order>[]) => {
            if (checked) {
                const selectedIds = rows.map((r) => r.original.id)
                dispatch(setSelectedRows(selectedIds))
            } else {
                dispatch(setSelectedRows([]))
            }
        },
        [dispatch],
    )

    return (
        <DataTable
            // Si tu DataTable tiene modo server-side, activalo (nombre varía):
            // manualSorting
            // serverSide
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

export default OrdersTable
