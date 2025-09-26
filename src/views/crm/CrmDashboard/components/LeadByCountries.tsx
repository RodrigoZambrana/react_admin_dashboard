import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import RegionMap from '@/components/shared/RegionMap'
import type { LeadRegion } from '../store'
import { useTranslation } from 'react-i18next'

type LeadByCountriesProps = {
    data?: LeadRegion[]
    className?: string
}

const mapColors = [
    '#4f46e5',
    '#3b82f6',
    '#22c55e',
    '#eab308',
    '#ec4899',
    '#a855f7',
]

const dotColor = [
    'bg-indigo-600',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-purple-500',
]

const getMapColors = (data: LeadRegion[] = []) => {
    return data.map((item, index) => ({
        ...item,
        color: mapColors[index],
    }))
}

const LeadByCountries = ({ data = [], className }: LeadByCountriesProps) => {
    const { t } = useTranslation()
    return (
        <Card className={className}>
            <h4>{t('crm.dashboard.leadByCountries.title')}</h4>
            <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 px-4">
                    <RegionMap data={getMapColors(data)} valueSuffix="%" />
                </div>
                <div className="flex flex-col justify-center px-4">
                    {data.map((item, index) => (
                        <div
                            key={item.name}
                            className="mb-6 flex justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <Badge innerClass={dotColor[index]} />
                                <div className="font-semibold">{item.name}</div>
                            </div>
                            <div>{item.value}%</div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}

export default LeadByCountries
