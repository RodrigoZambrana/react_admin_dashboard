import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import DataTable, {
    ColumnDef,
    DataTableResetHandle,
    OnSortParam,
} from '@/components/shared/DataTable'
import Tag from '@/components/ui/Tag'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import Button from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

const WORK_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CLOSED', 'CANCELED'] as const
type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

type ProductionOrderRecord = {
    id: number
    orderId: number
    workOrderId: number
    status: string
    priority: number
    assignedToId: number | null
    scheduledAt: string | null
    createdAt: string
    order: {
        id: number
        code: string
        customer: {
            id: number
            name: string
        } | null
    }
    workOrder: {
        id: number
        code: string
        status: string
    }
    assignedTo: {
        id: number
        name: string | null
        lastName: string | null
    } | null
}

type TableState = {
    pageIndex: number
    pageSize: number
    total: number
    status?: string
    search?: string
    sortKey?: 'createdAt' | 'scheduledAt'
    sortOrder?: 'asc' | 'desc'
}

type ProductionOrdersTableProps = {
    data: ProductionOrderRecord[]
    loading: boolean
    tableState: TableState
    onTableChange: (state: Partial<TableState>) => void
    onEdit: (record: ProductionOrderRecord) => void
    onDelete: (record: ProductionOrderRecord) => void
}

const statusOptions = WORK_ORDER_STATUSES.map((status) => ({
    value: status,
    label: status,
}))

const STATUS_TAG_COLOR: Record<WorkOrderStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    IN_PROGRESS: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    READY: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
    DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    CLOSED: 'bg-gray-200 text-gray-700 dark:bg-gray-500/20 dark:text-gray-200',
    CANCELED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
}

const ProductionOrdersTable = ({
    data,
    loading,
    tableState,
    onTableChange,
    onEdit,
    onDelete,
}: ProductionOrdersTableProps) => {
    const tableRef = useRef<DataTableResetHandle>(null)
    const { t } = useTranslation()
    const [searchValue, setSearchValue] = useState(tableState.search ?? '')

    useEffect(() => {
        setSearchValue(tableState.search ?? '')
    }, [tableState.search])

    const onSubmitSearch = useCallback(() => {
        onTableChange({ search: searchValue, pageIndex: 1 })
    }, [onTableChange, searchValue])

    const handleSearchKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                event.preventDefault()
                onSubmitSearch()
            }
        },
        [onSubmitSearch],
    )

    const columns = useMemo<ColumnDef<ProductionOrderRecord>[]>(
        () => [
            {
                header: t('text.columns.id'),
                accessorKey: 'id',
                cell: ({ row }) => `#${row.original.id}`,
            },
            {
                header: t('sales.productionOrders.columns.order', { defaultValue: 'Order' }),
                accessorKey: 'order',
                cell: ({ row }) => (
                    <div>
                        <div className="font-medium">#{row.original.order.id}</div>
                        {row.original.order.customer && (
                            <div className="text-xs text-gray-500 dark:text-gray-300">
                                {row.original.order.customer.name}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                header: t('sales.productionOrders.columns.workOrder', { defaultValue: 'Work order' }),
                accessorKey: 'workOrder',
                cell: ({ row }) => row.original.workOrder.code,
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: ({ row }) => (
                    <Tag
                        className={classNames(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            STATUS_TAG_COLOR[row.original.status as WorkOrderStatus] ??
                                'bg-gray-200 text-gray-700 dark:bg-gray-500/20 dark:text-gray-200',
                        )}
                    >
                        {t(`sales.productionOrders.status.${row.original.status}`, {
                            defaultValue: row.original.status,
                        })}
                    </Tag>
                ),
            },
            {
                header: t('sales.productionOrders.columns.priority', { defaultValue: 'Priority' }),
                accessorKey: 'priority',
            },
            {
                header: t('sales.productionOrders.columns.assignee', { defaultValue: 'Assignee' }),
                accessorKey: 'assignedTo',
                cell: ({ row }) =>
                    row.original.assignedTo?.name || row.original.assignedTo?.lastName
                        ? `${row.original.assignedTo?.name ?? ''} ${row.original.assignedTo?.lastName ?? ''}`.trim()
                        : t('common.labels.unassigned', { defaultValue: 'Unassigned' }),
            },
            {
                header: t('sales.productionOrders.columns.scheduled', { defaultValue: 'Scheduled' }),
                accessorKey: 'scheduledAt',
                cell: ({ row }) =>
                    row.original.scheduledAt
                        ? dayjs(row.original.scheduledAt).format('DD/MM/YYYY')
                        : t('common.labels.na'),
            },
            {
                header: t('text.columns.actions'),
                id: 'actions',
                cell: ({ row }) => (
                    <div className="flex justify-end gap-2 text-lg">
                        <Tooltip title={t('text.actions.edit')}>
                            <button
                                type="button"
                                className="text-blue-500 hover:text-blue-600"
                                onClick={() => onEdit(row.original)}
                            >
                                <HiOutlinePencil />
                            </button>
                        </Tooltip>
                        <Tooltip title={t('text.actions.delete')}>
                            <button
                                type="button"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => onDelete(row.original)}
                            >
                                <HiOutlineTrash />
                            </button>
                        </Tooltip>
                    </div>
                ),
            },
        ],
        [onDelete, onEdit, t],
    )

    const onPaginationChange = (page: number) => {
        onTableChange({ pageIndex: page + 1 })
    }

    const onPageSizeChange = (size: number) => {
        onTableChange({ pageSize: size, pageIndex: 1 })
    }

    const onSort = (sortParam: OnSortParam) => {
        const key = sortParam?.key === 'scheduledAt' ? 'scheduledAt' : 'createdAt'
        const order = sortParam?.order === 'ascend' ? 'asc' : sortParam?.order === 'descend' ? 'desc' : 'desc'
        onTableChange({ sortKey: key, sortOrder: order })
    }

    return (
        <div className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder={t('sales.productionOrders.filters.search', {
                            defaultValue: 'Search by customer, code or id',
                        })}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                    <Button size="sm" variant="solid" onClick={onSubmitSearch}>
                        {t('text.actions.search')}
                    </Button>
                </div>
                <Select
                    isClearable
                    className="min-w-[180px]"
                    placeholder={t('sales.productionOrders.filters.status', { defaultValue: 'Status' })}
                    value={
                        tableState.status
                            ? statusOptions.find((option) => option.value === tableState.status)
                            : null
                    }
                    options={statusOptions.map((option) => ({
                        value: option.value,
                        label: t(`sales.productionOrders.status.${option.value}`, {
                            defaultValue: option.value,
                        }),
                    }))}
                    onChange={(option) =>
                        onTableChange({
                            status: option ? (option as { value: string }).value : undefined,
                            pageIndex: 1,
                        })
                    }
                />
            </div>
            <DataTable
                ref={tableRef}
                columns={columns}
                data={data}
                loading={loading}
                pageIndex={tableState.pageIndex - 1}
                pageSize={tableState.pageSize}
                total={tableState.total}
                onPaginationChange={onPaginationChange}
                onSelectChange={onPageSizeChange}
                onSort={onSort}
            />
        </div>
    )
}

export default ProductionOrdersTable
