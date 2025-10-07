import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Chart from '@/components/shared/Chart'
import { COLORS } from '@/constants/chart.constant'
import { useTranslation } from 'react-i18next'

type SalesByCategoriesProps = {
    data?: {
        labels: string[]
        data: number[]
    }
}

const SalesByCategories = ({
    data = { labels: [], data: [] },
}: SalesByCategoriesProps) => {
    const { t } = useTranslation()
    const normalizedValues = Array.isArray(data.data)
        ? data.data.map((value) => Number(value) || 0)
        : []
    const totalSold = normalizedValues.reduce((acc, value) => acc + value, 0)
    const hasData =
        normalizedValues.length > 0 &&
        normalizedValues.some((value) => value > 0)

    return (
        <Card
            className={
                hasData
                    ? undefined
                    : 'bg-gray-50 border border-dashed border-gray-200 dark:bg-gray-800/40 dark:border-gray-600'
            }
        >
            <h4>{t('sales.dashboard.categories.title')}</h4>
            <div className="mt-6">
                {hasData ? (
                    <>
                        <Chart
                            donutTitle={`${totalSold}`}
                            donutText={t('sales.dashboard.categories.donutText')}
                            series={normalizedValues}
                            customOptions={{ labels: data.labels }}
                            type="donut"
                        />
                        {data.data.length === data.labels.length && (
                            <div className="mt-6 grid grid-cols-2 gap-4 max-w-[180px] mx-auto">
                                {data.labels.map((value, index) => (
                                    <div
                                        key={value}
                                        className="flex items-center gap-1"
                                    >
                                        <Badge
                                            badgeStyle={{
                                                backgroundColor: COLORS[index],
                                            }}
                                        />
                                        <span className="font-semibold">
                                            {value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-300">
                        <div className="h-32 w-32 rounded-full border-4 border-dashed border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700/40" />
                        <p className="mt-6 text-sm font-medium">
                            {t('sales.dashboard.categories.empty')}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    )
}

export default SalesByCategories
