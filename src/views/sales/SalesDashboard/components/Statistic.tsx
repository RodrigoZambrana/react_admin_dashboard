import Card from '@/components/ui/Card'
import { NumericFormat } from 'react-number-format'
import GrowShrinkTag from '@/components/shared/GrowShrinkTag'
import { useAppSelector } from '../store'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

type StatisticCardProps = {
    data?: {
        value: number
        growShrink: number
    }
    label: string
    valuePrefix?: string
    date: number
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

const StatisticCard = ({
    data = { value: 0, growShrink: 0 },
    label,
    valuePrefix,
    date,
}: StatisticCardProps) => {
    const { t } = useTranslation()
    return (
        <Card>
            <h6 className="font-semibold mb-4 text-sm">{label}</h6>
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-bold">
                        <NumericFormat
                            thousandSeparator
                            displayType="text"
                            value={data.value}
                            prefix={valuePrefix}
                        />
                    </h3>
                    <p>
                        {t('sales.dashboard.stat.vsMonths', {
                            months: 3,
                            date: dayjs(date).format('DD MMM'),
                        })}
                    </p>
                </div>
                <GrowShrinkTag value={data.growShrink} suffix="%" />
            </div>
        </Card>
    )
}

const Statistic = ({ data = {} }: StatisticProps) => {
    const startDate = useAppSelector(
        (state) => state.salesDashboard.data.startDate,
    )

    const { t } = useTranslation()
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-4">
            <StatisticCard
                data={data.revenue}
                valuePrefix="$"
                label={t('sales.dashboard.stat.revenue')}
                date={startDate}
            />
            <StatisticCard data={data.orders} label={t('sales.dashboard.stat.orders')} date={startDate} />
            <StatisticCard
                data={data.purchases}
                valuePrefix="$"
                label={t('sales.dashboard.stat.purchases')}
                date={startDate}
            />
        </div>
    )
}

export default Statistic
