import { useEffect, useCallback, useMemo, useRef } from 'react'
import Select from '@/components/ui/Select'
import { apiGetOrderStatuses, apiGetPaymentMethods } from '@/services/SettingsService'
import { apiUpdateSalesOrderStatus, apiUpdateSalesOrderPaymentMethod } from '@/services/SalesService'
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
    getOrders,
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
// Using formatOptionLabel ensures both menu options and selected value share the same layout

type Order = {
    id: string
    date: number
    customer: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
}

const colorClass = (color: string) => ({
    dotClass: `bg-${color}`,
    textClass: `text-${color}`,
})

const PaymentMethodImage = ({
    paymentMehod,
    className,
}: {
    paymentMehod: string
    className: string
}) => {
    switch (paymentMehod) {
        case 'visa':
            return (
                <img
                    className={className}
                    src="/img/others/img-8.png"
                    alt={paymentMehod}
                />
            )
        case 'master':
            return (
                <img
                    className={className}
                    src="/img/others/img-9.png"
                    alt={paymentMehod}
                />
            )
        case 'paypal':
            return (
                <img
                    className={className}
                    src="/img/others/img-10.png"
                    alt={paymentMehod}
                />
            )
        default:
            return <></>
    }
}

const OrderColumn = ({ row }: { row: Order }) => {
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

const OrdersTable = () => {
    const tableRef = useRef<DataTableResetHandle>(null)

    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const { pageIndex, pageSize, sort, query, total } = useAppSelector(
        (state) => state.salesOrderList.data.tableData,
    )
    const loading = useAppSelector((state) => state.salesOrderList.data.loading)
    const defaultOrderStatuses = useMemo(
        () => [
            { id: 0, name: 'Pagado', color: 'emerald-500' },
            { id: 1, name: 'Pendiente', color: 'amber-500' },
            { id: 2, name: 'Cancelado', color: 'red-500' },
        ],
        [],
    )
    const [statuses, setStatuses] = useState<{ id: number; name: string; color: string }[]>(
        defaultOrderStatuses,
    )

    const data = useAppSelector((state) => state.salesOrderList.data.orderList)
    const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([])

    const fetchData = useCallback(() => {
        console.log('{ pageIndex, pageSize, sort, query }', {
            pageIndex,
            pageSize,
            sort,
            query,
        })
        dispatch(getOrders({ pageIndex, pageSize, sort, query }))
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
            // Use name as value to match row.paymentMehod = name
            const opts = (res.data as any[]).map((m) => ({ value: m.name, label: m.name }))
            setPaymentMethods(opts)
        }
        fetchPaymentMethods()
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

    const columns: ColumnDef<Order>[] = useMemo(
        () => [
            {
                header: t('text.columns.order'),
                accessorKey: 'id',
                cell: (props) => <OrderColumn row={props.row.original} />,
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
                header: t('text.columns.customer'),
                accessorKey: 'customer',
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
                    const s = statuses.find((x) => x.id === statusId)
                    const options = statuses.map((x) => ({ value: x.id, label: x.name, color: x.color }))
                    const onChange = async (opt: any) => {
                        await apiUpdateSalesOrderStatus<boolean, { id: string; status: number }>({ id: row.id, status: opt.value })
                        // Refresh from store instead of mutating local row
                        dispatch(getOrders({ pageIndex, pageSize, sort, query }))
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
                                        <span className={`ml-2 rtl:mr-2 capitalize font-semibold text-${option.color}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                )}
                                style={{
                                    singleValue: (provided: any) => ({
                                        ...provided,
                                        display: 'flex',
                                        alignItems: 'center',
                                    }),
                                    valueContainer: (provided: any) => ({
                                        ...provided,
                                        display: 'flex',
                                        alignItems: 'center',
                                    }),
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
                    const row = props.row.original
                    const current = paymentMethods.find((m) => m.value === row.paymentMehod) || (row.paymentMehod ? { value: row.paymentMehod, label: row.paymentMehod } : undefined)
                    const onChange = async (opt: any) => {
                        await apiUpdateSalesOrderPaymentMethod<boolean, { id: string; paymentMehod: string }>({ id: row.id, paymentMehod: (opt as any)?.value ?? '' })
                        dispatch(getOrders({ pageIndex, pageSize, sort, query }))
                    }
                    return (
                        <div className="flex items-center min-w-[180px]">
                            <div className="w-[160px]">
                                <Select size="sm" options={paymentMethods} value={current as any} placeholder={t('settings.paymentMethods.title')} onChange={onChange} />
                            </div>
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.total'),
                accessorKey: 'totalAmount',
                cell: (props) => {
                    const { totalAmount } = props.row.original
                    return (
                        <NumericFormat
                            displayType="text"
                            value={(
                                Math.round(totalAmount * 100) / 100
                            ).toFixed(2)}
                            prefix={'$'}
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
        [t, statuses, paymentMethods, pageIndex, pageSize, sort, query, dispatch],
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

    const onRowSelect = (checked: boolean, row: Order) => {
        if (checked) {
            dispatch(addRowItem([row.id]))
        } else {
            dispatch(removeRowItem(row.id))
        }
    }

    const onAllRowSelect = useCallback(
        (checked: boolean, rows: Row<Order>[]) => {
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

export default OrdersTable
