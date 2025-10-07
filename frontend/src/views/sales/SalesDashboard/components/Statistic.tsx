import Card from '@/components/ui/Card'
import { NumericFormat } from 'react-number-format'
import { useTranslation } from 'react-i18next'

type StatisticCardProps = {
    data?: {
        value: number
        growShrink: number
    }
    label: string
    valuePrefix?: string
    colorConfig: StatisticCardColorConfig
}

type StatisticProps = {
    data?: {
        revenue?: {
            value: number
            growShrink: number
        }
        orders?: {
            value: number
            growShrink: number
        }
        purchases?: {
            value: number
            growShrink: number
        }
    }
}

type StatisticCardColorConfig = {
    container: string
    title: string
    value: string
}

const STATISTIC_CARD_COLORS: Record<'orders' | 'revenue' | 'purchases', StatisticCardColorConfig> =
    {
        orders: {
            container:
                'bg-indigo-50 border-indigo-200 shadow-sm dark:bg-indigo-500/20 dark:border-indigo-400/40',
            title: 'text-indigo-700 dark:text-indigo-100',
            value: 'text-indigo-900 dark:text-white',
        },
        revenue: {
            container:
                'bg-emerald-50 border-emerald-200 shadow-sm dark:bg-emerald-500/20 dark:border-emerald-400/40',
            title: 'text-emerald-700 dark:text-emerald-100',
            value: 'text-emerald-900 dark:text-white',
        },
        purchases: {
            container:
                'bg-sky-50 border-sky-200 shadow-sm dark:bg-sky-500/20 dark:border-sky-400/40',
            title: 'text-sky-700 dark:text-sky-100',
            value: 'text-sky-900 dark:text-white',
        },
    }

const StatisticCard = ({
    data = { value: 0, growShrink: 0 },
    label,
    valuePrefix,
    colorConfig,
}: StatisticCardProps) => {
    const titleClass = colorConfig.title
        ? `font-semibold mb-4 text-sm ${colorConfig.title}`
        : 'font-semibold mb-4 text-sm'
    const valueClass = colorConfig.value
        ? `font-bold ${colorConfig.value}`
        : 'font-bold'

    return (
        <Card className={colorConfig.container}>
            <h6 className={titleClass}>{label}</h6>
            <h3 className={valueClass}>
                <NumericFormat
                    thousandSeparator
                    displayType="text"
                    value={data?.value ?? 0}
                    prefix={valuePrefix}
                />
            </h3>
        </Card>
    )
}

const Statistic = ({ data = {} }: StatisticProps) => {
    const { t } = useTranslation()
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-4">
            <StatisticCard
                data={data.orders}
                label={t('sales.dashboard.stat.orders')}
                colorConfig={STATISTIC_CARD_COLORS.orders}
            />
            <StatisticCard
                data={data.revenue}
                valuePrefix="$"
                label={t('sales.dashboard.stat.revenue')}
                colorConfig={STATISTIC_CARD_COLORS.revenue}
            />
            <StatisticCard
                data={data.purchases}
                valuePrefix="$"
                label={t('sales.dashboard.stat.purchases')}
                colorConfig={STATISTIC_CARD_COLORS.purchases}
            />
        </div>
    )
}

export default Statistic
