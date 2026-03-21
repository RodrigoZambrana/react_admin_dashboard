import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type ProductionOrdersStatsProps = {
    data: {
        labels: string[]
        created: number[]
        completed: number[]
    } | null
}

const ProductionOrdersStats = ({ data }: ProductionOrdersStatsProps) => {
    const { t } = useTranslation()
    const chartConfig = useMemo(() => {
        return {
            series: [
                {
                    name: t('sales.productionOrders.stats.created', { defaultValue: 'Created' }),
                    data: data?.created ?? [],
                },
                {
                    name: t('sales.productionOrders.stats.completed', { defaultValue: 'Completed' }),
                    data: data?.completed ?? [],
                },
            ],
            options: {
                chart: {
                    sparkline: { enabled: false },
                    toolbar: { show: false },
                },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 3 },
                xaxis: {
                    categories: data?.labels ?? [],
                },
                grid: {
                    strokeDashArray: 5,
                },
            },
        }
    }, [data, t])

    return (
        <Card>
            <div className="mb-4">
                <h5>{t('sales.productionOrders.stats.title', { defaultValue: 'Monthly activity' })}</h5>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                    {t('sales.productionOrders.stats.subtitle', {
                        defaultValue: 'Orders created vs completed',
                    })}
                </p>
            </div>
            {data && data.labels.length ? (
                <Chart type="area" height={280} {...chartConfig} />
            ) : (
                <div className="text-sm text-gray-500 dark:text-gray-300">
                    {t('sales.productionOrders.stats.empty', { defaultValue: 'No activity recorded yet.' })}
                </div>
            )}
        </Card>
    )
}

export default ProductionOrdersStats
