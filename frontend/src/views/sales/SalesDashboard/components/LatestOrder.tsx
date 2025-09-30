import { useCallback } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import DataTable from '@/components/shared/DataTable'
import { useOrderColumns, type Order } from '@/views/sales/OrderList/components/useOrderColumns'
import { apiGetOrderStatuses } from '@/services/SettingsService'
import { apiUpdateSalesOrderStatus, apiGetSalesOrders } from '@/services/SalesService'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type LatestOrderProps = {
    data?: Order[]
    className?: string
}

const LatestOrder = ({ data = [], className }: LatestOrderProps) => {
    const { t } = useTranslation()
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
    const [rows, setRows] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetOrderStatuses<{ id: number | string; name: string; color: string }[]>()
            const normalized = (res.data as any[]).map((s) => ({ ...s, id: Number(s.id) }))
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
        >({ pageIndex: 1, pageSize: 10, sort: { key: 'date', order: 'desc' }, query: '' })
        setRows(res.data.data)
        setLoading(false)
    }

    useEffect(() => {
        fetchOrders()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const columns = useOrderColumns({ t, statuses, onChangeStatus, selectOnly: true })

    const navigate = useNavigate()

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
                pagingData={{ total: rows.length, pageIndex: 1, pageSize: 10 }}
            />
        </Card>
    )
}

export default LatestOrder
