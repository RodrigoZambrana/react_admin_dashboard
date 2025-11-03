import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import DataTable from '@/components/shared/DataTable'
import { useOrderColumns, type Order } from '@/views/sales/OrderList/components/useOrderColumns'
import { apiGetOrderStatuses } from '@/services/SettingsService'
import { apiUpdateSalesOrderStatus, apiGetSalesOrders } from '@/services/SalesService'
import { adaptSalesDocumentListRecord } from '@/adapters/sales'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deriveStatusColorClasses } from '@/utils/statusColor'

type LatestOrderProps = {
    data?: Order[]
    className?: string
}

const LatestOrder = ({ data = [], className }: LatestOrderProps) => {
    const { t } = useTranslation()
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

    const defaultOrderStatuses = useMemo<StatusOption[]>(
        () => [
            mapStatusOption(100, 'Pending', 'orange-500'),
            mapStatusOption(200, 'Paid', 'blue-500'),
            mapStatusOption(300, 'Cancelled', 'red-500'),
            mapStatusOption(400, 'Delivered', 'emerald-500'),
        ],
        [mapStatusOption],
    )
    const [statuses, setStatuses] = useState<StatusOption[]>(defaultOrderStatuses)
    const [rows, setRows] = useState<Order[]>(data)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetOrderStatuses<
                { id: number | string; label?: string; color?: string }[]
            >({ documentType: 'ORDER' })
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
            if (normalized.length) setStatuses(normalized)
        }
        fetch()
    }, [])

    const onChangeStatus = async (row: Order, status: number) => {
        await apiUpdateSalesOrderStatus<boolean, { id: string; status: number }>({ id: row.id, status })
        fetchOrders()
    }

    const fetchOrders = async () => {
        setLoading(true)
        const res = await apiGetSalesOrders<
            { data: Order[]; total: number },
            { pageIndex: number; pageSize: number; sort: { key: string; order: string }; query: string }
        >({ pageIndex: 1, pageSize: 50, sort: { key: 'date', order: 'desc' }, query: '' })
        setRows(
            (res.data.data || []).map((order) =>
                adaptSalesDocumentListRecord(order, { resource: 'orders', mode: 'order' }),
            ),
        )
        setLoading(false)
    }

    useEffect(() => {
        fetchOrders()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const columns = useOrderColumns({ t, statuses, onChangeStatus, selectOnly: true })

    const navigate = useNavigate()

    useEffect(() => {
        if (Array.isArray(data)) {
            setRows(
                data.map((order) =>
                    adaptSalesDocumentListRecord(order, { resource: 'orders', mode: 'order' }),
                ),
            )
        } else {
            setRows([])
        }
    }, [data])

    return (
        <Card className={className}>
            <div className="flex items-center justify-between mb-6">
                <h4>{t('sales.dashboard.latestOrders.title')}</h4>
                <Button size="sm" onClick={() => navigate('/app/sales/order-list')}>
                    {t('sales.dashboard.latestOrders.viewOrders')}
                </Button>
            </div>
            <DataTable
                columns={columns}
                data={rows}
                loading={loading}
                pagingData={{ total: rows.length, pageIndex: 1, pageSize: 50 }}
            />
        </Card>
    )
}

export default LatestOrder
