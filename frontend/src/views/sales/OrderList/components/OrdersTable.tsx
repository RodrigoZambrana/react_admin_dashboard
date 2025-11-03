import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import Select from '@/components/ui/Select'
import Tooltip from '@/components/ui/Tooltip'
import DataTable from '@/components/shared/DataTable'
import { HiOutlineDocumentText, HiOutlineEye, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi'
import {
    setSelectedRows,
    addRowItem,
    removeRowItem,
    setDeleteMode,
    setSelectedRow,
    getOrders,
    setTableData,
    useAppDispatch,
    useSalesOrderListData,
} from '../store'
import { apiGetOrderStatuses, apiGetPaymentMethods } from '@/services/SettingsService'
import { apiUpdateSalesOrderStatus, apiUpdateSalesOrderPaymentMethod } from '@/services/SalesService'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { useNavigate } from 'react-router-dom'
import cloneDeep from 'lodash/cloneDeep'
import { deriveStatusColorClasses } from '@/utils/statusColor'
import { ORDER_STATUS_CHANGE_ALLOWED } from '@/constants/orderStatus'
import dayjs from 'dayjs'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
    Row,
} from '@/components/shared/DataTable'
import type { StylesConfig } from 'react-select'
import { useSalesDocumentI18n } from '../../context/useSalesDocumentI18n'
import type { SalesDocumentSummaryComputation } from '@/utils/salesDocumentCalculations'
import { formatOrderMoney } from '@/utils/orderMoney'

type Order = {
    id: string
    date: number
    customer: string
    status: number | string
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
    orderCurrency?: string
    validUntilDate?: number | string | null
    paymentSummary?: {
        subTotal?: number
        deliveryFees?: number
        tax?: number
        total?: number
        currency?: string
    }
    computedSummary?: SalesDocumentSummaryComputation
}

const sortKeyMap: Record<string, string> = {
    id: 'id',
    date: 'date',
    validUntilDate: 'validUntilDate',
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

const OrderColumnCell = ({ row, onView }: { row: Order; onView: () => void }) => {
    const { textTheme } = useThemeClass()
    return (
        <span
            className={`cursor-pointer select-none font-semibold hover:${textTheme}`}
            onClick={onView}
        >
            #{row.id}
        </span>
    )
}

const ActionColumnCell = ({
    onView,
    onEdit,
    onInvoice,
    onDelete,
    invoiceLabel,
}: {
    onView: () => void
    onEdit: () => void
    onInvoice: () => void
    onDelete: () => void
    invoiceLabel: string
}) => {
    const { textTheme } = useThemeClass()
    const { t } = useSalesDocumentI18n()
    return (
        <div className="flex justify-end text-lg">
            <Tooltip title={t('text.actions.view')}>
                <span className={`cursor-pointer p-2 hover:${textTheme}`} onClick={onView}>
                    <HiOutlineEye />
                </span>
            </Tooltip>
            <Tooltip title={t('text.actions.edit')}>
                <span className={`cursor-pointer p-2 hover:${textTheme}`} onClick={onEdit}>
                    <HiOutlinePencil />
                </span>
            </Tooltip>
            <Tooltip title={invoiceLabel}>
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
    const navigate = useNavigate()
    const { t, tDoc, resource: contextResource, routes } = useSalesDocumentI18n()

    const salesOrderState = useSalesOrderListData()
    const { tableData: tableDataState, loading, orderList: data } = salesOrderState
    const { pageIndex, pageSize, sort, query, total } = tableDataState
    const currentResource = contextResource

    type StatusOption = {
        id: number
        name: string
        dotClass: string
        textClass: string
        customColor?: string
    }

    const mapStatusOption = useCallback((id: number, name: string, color?: string): StatusOption => {
        const classes = deriveStatusColorClasses(color)
        return {
            id,
            name,
            dotClass: classes.dotClass || 'bg-gray-400',
            textClass: classes.textClass || 'text-gray-600',
            customColor: classes.customColor,
        }
    }, [])

    const defaultOrderStatuses = useMemo<StatusOption[]>(() => {
        if (currentResource === 'budgets') {
            return [
                mapStatusOption(1000, 'Quote - Draft', '#9ca3af'),
                mapStatusOption(1010, 'Quote - Sent', '#3b82f6'),
                mapStatusOption(1020, 'Quote - Accepted', '#10b981'),
                mapStatusOption(1050, 'Quote - Expired', '#f97316'),
            ]
        }
        return [
            mapStatusOption(100, 'Pending', 'orange-500'),
            mapStatusOption(200, 'Paid', 'blue-500'),
            mapStatusOption(300, 'Cancelled', 'red-500'),
            mapStatusOption(400, 'Delivered', 'emerald-500'),
        ]
    }, [currentResource, mapStatusOption])
    const [statuses, setStatuses] = useState<StatusOption[]>(defaultOrderStatuses)
    const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([])

    const fetchData = useCallback(() => {
        const normalized = normalizeSort(sort as any)
        dispatch(
            getOrders({
                pageIndex,
                pageSize,
                sort: normalized,
                query,
                resource: currentResource,
            }),
        )
    }, [dispatch, pageIndex, pageSize, sort, query, currentResource])

    useEffect(() => {
        dispatch(setSelectedRows([]))
        fetchData()
    }, [dispatch, fetchData])

    useEffect(() => {
        const fetchStatuses = async () => {
            const res = await apiGetOrderStatuses<
                { id: number | string; label?: string; color?: string; documentTypes?: string[] }[]
            >({ documentType: currentResource === 'budgets' ? 'BUDGET' : 'ORDER' })
            const normalized = (res.data || []).map((status) => {
                const classes = deriveStatusColorClasses(status.color)
                return {
                    id: Number(status.id),
                    name: status.label || String(status.id),
                    dotClass: classes.dotClass || 'bg-gray-400',
                    textClass: classes.textClass || 'text-gray-600',
                    customColor: classes.customColor,
                }
            })
            if (normalized.length) {
                setStatuses(normalized)
            }
        }
        fetchStatuses()
    }, [currentResource])

    useEffect(() => {
        const fetchPaymentMethods = async () => {
            const res = await apiGetPaymentMethods<
                { id: number | string; label?: string; code?: string }[]
            >()
            const opts = (res.data || []).map((method) => ({
                value: method.label || String(method.id),
                label: method.label || String(method.id),
            }))
            setPaymentMethods(opts)
        }
        fetchPaymentMethods()
    }, [])

    useEffect(() => {
        tableRef.current?.resetSelected?.()
    }, [data])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total, resource: currentResource }),
        [pageIndex, pageSize, sort, query, total, currentResource],
    )

    const selectStyles = useMemo<StylesConfig<any, false>>(
        () => ({
            valueContainer: (provided) => ({ ...provided, display: 'flex', alignItems: 'center' }),
            singleValue: (provided) => ({ ...provided, display: 'flex', alignItems: 'center' }),
        }),
        [],
    )

    const handleView = useCallback(
        (id: string) => {
            navigate(`${routes.details}/${id}`)
        },
        [navigate, routes.details],
    )

    const handleEdit = useCallback(
        (id: string) => {
            navigate(`${routes.edit}/${id}`)
        },
        [navigate, routes.edit],
    )

    const handleInvoice = useCallback(
        (id: string) => {
            navigate(`${routes.invoice}/${id}`)
        },
        [navigate, routes.invoice],
    )

    const handleDelete = useCallback(
        (id: string) => {
            dispatch(setDeleteMode('single'))
            dispatch(setSelectedRow([id]))
        },
        [dispatch],
    )

    const columns: ColumnDef<Order>[] = useMemo(() => {
        const baseColumns: ColumnDef<Order>[] = [
            {
                header: tDoc('table.id', {
                    defaultValue:
                        currentResource === 'budgets' ? 'Presupuesto' : 'Pedido',
                }),
                accessorKey: 'id',
                cell: (p) => (
                    <OrderColumnCell
                        row={p.row.original}
                        onView={() => handleView(p.row.original.id)}
                    />
                ),
            },
            {
                header: t('text.columns.date'),
                accessorKey: 'date',
                cell: (p) => (
                    <span>{dayjs.unix(p.row.original.date).format('DD/MM/YYYY')}</span>
                ),
            },
            { header: t('text.columns.customer'), accessorKey: 'customer' },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const statusId =
                        typeof row.status === 'string'
                            ? parseInt(row.status as any, 10)
                            : (row.status as number)
                    const s = statuses.find((x) => x.id === statusId)
                    const options = statuses.map((x) => ({
                        value: x.id,
                        label: x.name,
                        dotClass: x.dotClass,
                        textClass: x.textClass,
                        customColor: x.customColor,
                    }))
                    const onChange = async (opt: any) => {
                        if (currentResource === 'orders' && !ORDER_STATUS_CHANGE_ALLOWED.has(Number(opt.value))) {
                            return
                        }
                        await apiUpdateSalesOrderStatus<boolean, { id: string; status: number }>(
                            { id: row.id, status: opt.value },
                            currentResource,
                        )
                        dispatch(setSelectedRows([]))
                        fetchData()
                    }
                    return (
                        <div className="min-w-[160px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{
                                    value: s?.id ?? statusId,
                                    label: s?.name ?? String(statusId),
                                    dotClass: s?.dotClass ?? 'bg-gray-400',
                                    textClass: s?.textClass ?? 'text-gray-600',
                                    customColor: s?.customColor,
                                } as any}
                                isOptionDisabled={(option: any) =>
                                    currentResource === 'orders'
                                        ? !ORDER_STATUS_CHANGE_ALLOWED.has(Number(option.value))
                                        : false
                                }
                                formatOptionLabel={(option: any) => (
                                    <div className="flex items-center">
                                        <span
                                            className={`badge-dot ${option.dotClass || 'bg-gray-400'}`}
                                            style={option.customColor ? { backgroundColor: option.customColor } : undefined}
                                        ></span>
                                        <span
                                            className={`ml-2 rtl:mr-2 capitalize font-semibold ${option.textClass || 'text-gray-600'}`}
                                            style={option.customColor ? { color: option.customColor } : undefined}
                                        >
                                            {option.label}
                                        </span>
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
                        (row.paymentMehod
                            ? { value: row.paymentMehod, label: row.paymentMehod }
                            : undefined)
                    const onChange = async (opt: any) => {
                        await apiUpdateSalesOrderPaymentMethod<
                            boolean,
                            { id: string; paymentMehod: string }
                        >(
                            {
                                id: row.id,
                                paymentMehod: (opt as any)?.value ?? '',
                            },
                            currentResource,
                        )
                        dispatch(setSelectedRows([]))
                        fetchData()
                    }
                    return (
                        <div className="flex items-center min-w-[200px]">
                            <div className="w-[180px]">
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
                    return <span>{formatOrderMoney(totalAmount, orderCurrency)}</span>
                },
            },
        ]

        if (currentResource === 'budgets') {
            const validUntilHeader = tDoc('validUntilLabel', {
                defaultValue: t('sales.orders.validUntilLabel', {
                    defaultValue: 'Valid until',
                }),
            })
            baseColumns.splice(2, 0, {
                header: validUntilHeader,
                accessorKey: 'validUntilDate',
                cell: (props) => {
                    const row = props.row.original
                    const raw = row.validUntilDate ?? (row as any)?.valid_until ?? null
                    if (!raw) {
                        return <span>—</span>
                    }
                    const parsed = dayjs(raw)
                    if (!parsed.isValid()) {
                        return <span>—</span>
                    }
                    return <span>{parsed.format('DD/MM/YYYY')}</span>
                },
            })
        }

        baseColumns.push({
            header: '',
            id: 'action',
            enableSorting: false,
            cell: (p) => (
                <ActionColumnCell
                    onView={() => handleView(p.row.original.id)}
                    onEdit={() => handleEdit(p.row.original.id)}
                    onInvoice={() => handleInvoice(p.row.original.id)}
                    onDelete={() => handleDelete(p.row.original.id)}
                    invoiceLabel={tDoc('invoiceAction', {
                        defaultValue: 'Documento',
                    })}
                />
            ),
        })

        return baseColumns
    }, [
        t,
        tDoc,
        statuses,
        paymentMethods,
        selectStyles,
        handleView,
        handleEdit,
        handleInvoice,
        handleDelete,
        dispatch,
        fetchData,
        currentResource,
    ])

    const onPaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        newTableData.resource = currentResource
        dispatch(setTableData(newTableData))
        dispatch(setSelectedRows([]))
    }

    const onSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        newTableData.resource = currentResource
        dispatch(setTableData(newTableData))
        dispatch(setSelectedRows([]))
    }

    const onSort = (nextSort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = normalizeSort(nextSort) as any
        newTableData.resource = currentResource
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
