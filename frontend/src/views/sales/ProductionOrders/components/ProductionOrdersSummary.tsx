import Card from '@/components/ui/Card'
import { useTranslation } from 'react-i18next'

const WORK_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CLOSED', 'CANCELED'] as const

type ProductionOrdersSummaryProps = {
    data: {
        total: number
        overdue: number
        byStatus: Record<string, number>
    } | null
}

const statusColors: Record<string, string> = {
    PENDING: 'text-amber-500',
    IN_PROGRESS: 'text-blue-500',
    READY: 'text-cyan-500',
    DELIVERED: 'text-emerald-500',
    CLOSED: 'text-slate-600',
    CANCELED: 'text-red-500',
}

const ProductionOrdersSummary = ({ data }: ProductionOrdersSummaryProps) => {
    const { t } = useTranslation()
    const total = data?.total ?? 0
    const overdue = data?.overdue ?? 0
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
                <div className="text-sm text-gray-500 dark:text-gray-300">
                    {t('sales.productionOrders.summary.total', { defaultValue: 'Total orders' })}
                </div>
                <div className="mt-2 text-2xl font-semibold">{total}</div>
            </Card>
            <Card>
                <div className="text-sm text-gray-500 dark:text-gray-300">
                    {t('sales.productionOrders.summary.overdue', { defaultValue: 'Overdue' })}
                </div>
                <div className="mt-2 text-2xl font-semibold text-red-500">{overdue}</div>
            </Card>
            {WORK_ORDER_STATUSES.map((status) => (
                <Card key={status}>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                        {t(`sales.productionOrders.status.${status}`, {
                            defaultValue: status,
                        })}
                    </div>
                    <div className={`mt-2 text-2xl font-semibold ${statusColors[status] ?? ''}`}>
                        {data?.byStatus?.[status] ?? 0}
                    </div>
                </Card>
            ))}
        </div>
    )
}

export default ProductionOrdersSummary
