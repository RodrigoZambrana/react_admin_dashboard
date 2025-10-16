import Card from '@/components/ui/Card'
import GrowShrinkTag from '@/components/shared/GrowShrinkTag'
import { NumericFormat } from 'react-number-format'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '../store'
import type { ComponentPropsWithoutRef } from 'react'

type Statistic = {
    value: number
    growShrink: number
}

type StatisticProps = ComponentPropsWithoutRef<'div'> & {
    data?: {
        total: Statistic
        transactions: Statistic
        recurring: Statistic
    }
}

type StatisticCardProps = ComponentPropsWithoutRef<'div'> & {
    data: Statistic
    label: string
    valuePrefix?: string
    date: number
}

const StatisticCard = ({ data, label, valuePrefix = '', date }: StatisticCardProps) => {
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
                        {t('expenses.dashboard.stat.vsMonths', {
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

const Statistic = ({ data = {} as any }: StatisticProps) => {
    const startDate = useAppSelector((state) => state.expensesDashboard.data.startDate)
    const { t } = useTranslation()
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-4">
            <StatisticCard
                data={data.transactions}
                label={t('expenses.dashboard.stat.transactions')}
                date={startDate}
            />
            <StatisticCard
                data={data.total}
                valuePrefix="$"
                label={t('expenses.dashboard.stat.total')}
                date={startDate}
            />
            <StatisticCard
                data={data.recurring}
                valuePrefix="$"
                label={t('expenses.dashboard.stat.recurring')}
                date={startDate}
            />
        </div>
    )
}

export default Statistic
