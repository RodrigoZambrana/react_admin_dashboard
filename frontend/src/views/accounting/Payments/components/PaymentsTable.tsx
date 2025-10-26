import { useEffect, useMemo, useRef, useCallback } from 'react'
import DataTable from '@/components/shared/DataTable'
import type {
    ColumnDef,
    DataTableResetHandle,
    OnSortParam,
} from '@/components/shared/DataTable'
import { NumericFormat } from 'react-number-format'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import Tag from '@/components/ui/Tag'
import classNames from 'classnames'
import {
    useAppDispatch,
    useAppSelector,
    getPayments,
    setTableData,
    toggleDeleteDialog,
    togglePaymentDialog,
} from '../store'
import type { Payment, PaymentStatus, PaymentType, PaymentsTableState } from '../store/paymentsSlice'

const statusColor: Record<PaymentStatus, string> = {
    CONFIRMED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    REGISTERED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
}

const typeColor: Record<PaymentType, string> = {
    DEPOSIT: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    BALANCE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
    REFUND: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
}

const PaymentsTable = () => {
    const tableRef = useRef<DataTableResetHandle>(null)
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const payments = useAppSelector((state) => state.accountingPayments.data.payments)
    const tableData = useAppSelector((state) => state.accountingPayments.data.tableData)
    const loading = useAppSelector((state) => state.accountingPayments.data.loading)

    const { pageIndex = 1, pageSize = 25, sort, total = 0, status, type, query } = tableData

    const requestData = useMemo(
        () => ({
            pageIndex,
            pageSize,
            sort,
            status,
            type,
            query,
        }),
        [pageIndex, pageSize, sort, status, type, query],
    )

    const fetchData = useCallback(() => {
        dispatch(getPayments(requestData as PaymentsTableState))
    }, [dispatch, requestData])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const onPaginationChange = (page: number) => {
        dispatch(
            setTableData({
                ...tableData,
                pageIndex: page,
            }),
        )
    }

    const onPageSizeChange = (size: number) => {
        dispatch(
            setTableData({
                ...tableData,
                pageIndex: 1,
                pageSize: size,
            }),
        )
    }

    const onSort = (sorting: OnSortParam) => {
        const rawKey = sorting?.key
        const rawOrder = sorting?.order
        const order =
            rawOrder === 'ascend'
                ? 'asc'
                : rawOrder === 'descend'
                  ? 'desc'
                  : rawOrder === 'asc' || rawOrder === 'desc'
                    ? rawOrder
                    : ''
        const key = rawKey ? String(rawKey) : ''
        dispatch(
            setTableData({
                ...tableData,
                sort: {
                    key,
                    order,
                },
            }),
        )
    }

    const onEdit = useCallback(
        (paymentId: number) => {
            dispatch(togglePaymentDialog({ open: true, mode: 'edit', paymentId }))
        },
        [dispatch],
    )

    const onDelete = useCallback(
        (paymentId: number) => {
            dispatch(toggleDeleteDialog({ open: true, paymentId }))
        },
        [dispatch],
    )

    const columns: ColumnDef<Payment>[] = useMemo(
        () => [
            {
                header: t('text.columns.id'),
                accessorKey: 'id',
                cell: (props) => `#${props.row.original.id}`,
            },
            {
                header: t('text.columns.date'),
                accessorKey: 'date',
                cell: (props) => dayjs(props.row.original.date).format('YYYY-MM-DD'),
            },
            {
                header: t('accounting.payments.columns.order'),
                accessorKey: 'orderId',
                cell: (props) => {
                    const row = props.row.original
                    return `#${row.orderId}`
                },
            },
            {
                header: t('accounting.payments.columns.customer'),
                accessorKey: 'order.customerName',
                cell: (props) => props.row.original.order?.customerName ?? t('text.na'),
            },
            {
                header: t('text.columns.amount'),
                accessorKey: 'amount',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <NumericFormat
                            displayType="text"
                            value={row.amount}
                            thousandSeparator
                            prefix=""
                            decimalScale={2}
                            fixedDecimalScale
                        />
                    )
                },
            },
            {
                header: t('text.columns.currency'),
                accessorKey: 'currency',
                cell: (props) => props.row.original.currency,
            },
            {
                header: t('text.columns.type'),
                accessorKey: 'type',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <Tag
                            className={classNames(
                                'rounded-full px-3 py-1 text-xs font-semibold',
                                typeColor[row.type],
                            )}
                        >
                            {t(`accounting.payments.type.${row.type.toLowerCase()}`)}
                        </Tag>
                    )
                },
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <Tag
                            className={classNames(
                                'rounded-full px-3 py-1 text-xs font-semibold',
                                statusColor[row.status],
                            )}
                        >
                            {t(`accounting.payments.status.${row.status.toLowerCase()}`)}
                        </Tag>
                    )
                },
            },
            {
                header: t('accounting.payments.columns.method'),
                accessorKey: 'method',
                cell: (props) => props.row.original.method ?? t('text.na'),
            },
            {
                header: t('accounting.payments.columns.reference'),
                accessorKey: 'reference',
                cell: (props) => props.row.original.reference ?? t('text.na'),
            },
            {
                header: '',
                id: 'actions',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <div className="flex justify-end text-lg">
                            <button
                                type="button"
                                onClick={() => onEdit(row.id)}
                                className="p-2 hover:text-emerald-500"
                                aria-label={t('text.actions.edit') as string}
                            >
                                <HiOutlinePencil />
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(row.id)}
                                className="p-2 hover:text-red-500"
                                aria-label={t('text.actions.delete') as string}
                            >
                                <HiOutlineTrash />
                            </button>
                        </div>
                    )
                },
            },
        ],
        [t, onEdit, onDelete],
    )

    return (
        <DataTable
            ref={tableRef}
            columns={columns}
            data={payments}
            loading={loading}
            pageIndex={pageIndex - 1}
            pageSize={pageSize}
            total={total}
            onPaginationChange={(page) => onPaginationChange(page + 1)}
            onSelectChange={onPageSizeChange}
            onSort={onSort}
        />
    )
}

export default PaymentsTable
