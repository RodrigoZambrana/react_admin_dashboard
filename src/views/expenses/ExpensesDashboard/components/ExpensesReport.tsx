import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import { useTranslation } from 'react-i18next'

type ExpensesReportProps = {
    data?: {
        series?: {
            name: string
            data: number[]
        }[]
        categories?: string[]
    }
    className?: string
}

const ExpensesReport = ({ className, data = {} }: ExpensesReportProps) => {
    const { t } = useTranslation()
    return (
        <Card className={className}>
            <div className="flex items-center justify-between">
                <h4>{t('expenses.dashboard.expensesReport.title')}</h4>
                <Button size="sm">{t('expenses.dashboard.expensesReport.export')}</Button>
            </div>
            <Chart
                series={data.series}
                xAxis={data.categories}
                height="380px"
                customOptions={{ legend: { show: false } }}
            />
        </Card>
    )
}

export default ExpensesReport

