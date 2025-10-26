import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import AdaptableCard from '@/components/shared/AdaptableCard'
import ProductionOrdersTable from './components/ProductionOrdersTable'
import ProductionOrdersSummary from './components/ProductionOrdersSummary'
import ProductionOrdersStats from './components/ProductionOrdersStats'
import ProductionOrderFormDialog from './components/ProductionOrderFormDialog'
import ProductionOrderDeleteDialog from './components/ProductionOrderDeleteDialog'
import {
    apiGetProductionOrders,
    apiGetProductionOrdersSummary,
    apiGetProductionOrdersStats,
    apiCreateProductionOrder,
    apiUpdateProductionOrder,
    apiDeleteProductionOrder,
} from '@/services/ProductionOrdersService'

type ProductionOrderRecord = {
    id: number
    orderId: number
    workOrderId: number
    status: string
    priority: number
    assignedToId: number | null
    scheduledAt: string | null
    startedAt: string | null
    completedAt: string | null
    deliveredAt: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
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

type SummaryResponse = {
    total: number
    overdue: number
    byStatus: Record<string, number>
}

type StatsResponse = {
    labels: string[]
    created: number[]
    completed: number[]
}

type TableState = {
    pageIndex: number
    pageSize: number
    total: number
    status?: string
    assignedToId?: number
    priority?: number
    search?: string
    sortKey?: 'createdAt' | 'scheduledAt'
    sortOrder?: 'asc' | 'desc'
}

const defaultTableState: TableState = {
    pageIndex: 1,
    pageSize: 25,
    total: 0,
    sortKey: 'createdAt',
    sortOrder: 'desc',
}

const ProductionOrders = () => {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState<ProductionOrderRecord[]>([])
    const [summary, setSummary] = useState<SummaryResponse | null>(null)
    const [stats, setStats] = useState<StatsResponse | null>(null)
    const [tableState, setTableState] = useState<TableState>(defaultTableState)
    const [formOpen, setFormOpen] = useState(false)
    const [editingOrder, setEditingOrder] = useState<ProductionOrderRecord | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ProductionOrderRecord | null>(null)

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const response = await apiGetProductionOrders<{
                data: ProductionOrderRecord[]
                total: number
                pageIndex: number
                pageSize: number
            }>(tableState)
            const payload = response.data
            setOrders(payload.data)
            setTableState((prev) => ({
                ...prev,
                total: payload.total,
                pageIndex: payload.pageIndex,
                pageSize: payload.pageSize,
            }))
        } finally {
            setLoading(false)
        }
    }, [tableState.pageIndex, tableState.pageSize, tableState.status, tableState.assignedToId, tableState.priority, tableState.search, tableState.sortKey, tableState.sortOrder])

    const fetchSummary = useCallback(async () => {
        const response = await apiGetProductionOrdersSummary<SummaryResponse>()
        setSummary(response.data)
    }, [])

    const fetchStats = useCallback(async () => {
        const response = await apiGetProductionOrdersStats<StatsResponse>()
        setStats(response.data)
    }, [])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    useEffect(() => {
        fetchSummary()
        fetchStats()
    }, [fetchSummary, fetchStats])

    const onTableChange = useCallback((state: Partial<TableState>) => {
        setTableState((prev) => ({
            ...prev,
            ...state,
        }))
    }, [])

    const onCreate = useCallback(() => {
        setEditingOrder(null)
        setFormOpen(true)
    }, [])

    const onEdit = useCallback((record: ProductionOrderRecord) => {
        setEditingOrder(record)
        setFormOpen(true)
    }, [])

    const onDelete = useCallback((record: ProductionOrderRecord) => {
        setDeleteTarget(record)
    }, [])

    const onSubmit = useCallback(
        async (values: Record<string, unknown>) => {
            if (editingOrder) {
                await apiUpdateProductionOrder<boolean, Record<string, unknown>>(editingOrder.id, values)
            } else {
                await apiCreateProductionOrder<boolean, Record<string, unknown>>(values)
            }
            setFormOpen(false)
            setEditingOrder(null)
            fetchOrders()
            fetchSummary()
            fetchStats()
        },
        [editingOrder, fetchOrders, fetchStats, fetchSummary],
    )

    const onConfirmDelete = useCallback(async () => {
        if (!deleteTarget) return
        await apiDeleteProductionOrder<boolean>(deleteTarget.id)
        setDeleteTarget(null)
        fetchOrders()
        fetchSummary()
        fetchStats()
    }, [deleteTarget, fetchOrders, fetchStats, fetchSummary])

    const summaryData = useMemo(() => summary, [summary])
    const statsData = useMemo(() => stats, [stats])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3>{t('sales.productionOrders.title', { defaultValue: 'Production orders' })}</h3>
                <Button variant="solid" onClick={onCreate}>
                    {t('sales.productionOrders.actions.new', { defaultValue: 'New production order' })}
                </Button>
            </div>
            <ProductionOrdersSummary data={summaryData} />
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <AdaptableCard bodyClass="p-0">
                        <ProductionOrdersTable
                            data={orders}
                            loading={loading}
                            tableState={tableState}
                            onTableChange={onTableChange}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </AdaptableCard>
                </div>
                <div>
                    <ProductionOrdersStats data={statsData} />
                </div>
            </div>
            <ProductionOrderFormDialog
                open={formOpen}
                onClose={() => {
                    setFormOpen(false)
                    setEditingOrder(null)
                }}
                onSubmit={onSubmit}
                record={editingOrder}
            />
            <ProductionOrderDeleteDialog
                record={deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={onConfirmDelete}
            />
        </div>
    )
}

export default ProductionOrders
