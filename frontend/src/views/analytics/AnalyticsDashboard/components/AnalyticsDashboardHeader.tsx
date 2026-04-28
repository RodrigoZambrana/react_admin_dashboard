import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { useAppDispatch, useAppSelector } from '@/store'
import { HiOutlineFilter } from 'react-icons/hi'
import dayjs from 'dayjs'
import { useMemo } from 'react'

import {
    getAnalyticsDashboardData,
    setDateRangePreset,
    setEndDate,
    setStartDate,
} from '../store'
import { formatRangeLabel, resolvePresetRange, type DateRangePreset } from '../utils'
import type { AnalyticsDashboardState } from '../store'

const dateFormat = 'MMM DD, YYYY'
const { DatePickerRange } = DatePicker

type RangeOption = {
    value: DateRangePreset
    label: string
}

type AnalyticsDashboardHeaderProps = {
    title: string
    subtitle: string
}

const AnalyticsDashboardHeader = ({ title, subtitle }: AnalyticsDashboardHeaderProps) => {
    const dispatch = useAppDispatch()

    const fallbackRange = useMemo(() => resolvePresetRange('last7Days'), [])
    const startDate = useAppSelector(
        (state) =>
            (state as {
                analyticsDashboard?: { data: AnalyticsDashboardState }
            }).analyticsDashboard?.data?.startDate ?? fallbackRange[0],
    )
    const endDate = useAppSelector(
        (state) =>
            (state as {
                analyticsDashboard?: { data: AnalyticsDashboardState }
            }).analyticsDashboard?.data?.endDate ?? fallbackRange[1],
    )
    const dateRangePreset = useAppSelector(
        (state) =>
            (state as {
                analyticsDashboard?: { data: AnalyticsDashboardState }
            }).analyticsDashboard?.data?.dateRangePreset ?? 'last7Days',
    )

    const rangeOptions: RangeOption[] = useMemo(
        () => [
            { value: 'today', label: 'Today' },
            { value: 'last7Days', label: 'Last 7 days' },
            { value: 'last30Days', label: 'Last 30 days' },
            { value: 'last12Months', label: 'Last 12 months' },
            { value: 'custom', label: 'Custom' },
        ],
        [],
    )

    const handleDateChange = (value: [Date | null, Date | null]) => {
        const [rangeStart, rangeEnd] = value
        const normalizedStart = rangeStart
            ? dayjs(rangeStart).startOf('day').unix()
            : null
        const normalizedEnd = rangeEnd
            ? dayjs(rangeEnd).endOf('day').unix()
            : null

        if (normalizedStart !== null) {
            dispatch(setStartDate(normalizedStart))
        }
        if (normalizedEnd !== null) {
            dispatch(setEndDate(normalizedEnd))
        }
        dispatch(setDateRangePreset('custom'))
        if (normalizedStart !== null && normalizedEnd !== null) {
            void dispatch(getAnalyticsDashboardData() as any)
        }
    }

    const handleRangeChange = (option: RangeOption | null) => {
        const nextPreset = option?.value ?? 'custom'
        dispatch(setDateRangePreset(nextPreset))
        if (nextPreset !== 'custom') {
            const [nextStart, nextEnd] = resolvePresetRange(nextPreset)
            dispatch(setStartDate(nextStart))
            dispatch(setEndDate(nextEnd))
            void dispatch(getAnalyticsDashboardData() as any)
        }
    }

    const onFilter = () => {
        void dispatch(getAnalyticsDashboardData() as any)
    }

    const selectedOption =
        rangeOptions.find((option) => option.value === dateRangePreset) ??
        rangeOptions[1]

    return (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <h2 className="m-0">{title}</h2>
                </div>
                <p className="max-w-2xl text-sm text-gray-500">{subtitle}</p>
                <div className="text-xs text-gray-400">
                    Current range: {formatRangeLabel(startDate, endDate)}
                </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Period
                    </span>
                    <Select<RangeOption>
                        options={rangeOptions}
                        value={selectedOption}
                        size="sm"
                        className="min-w-[180px]"
                        onChange={handleRangeChange}
                        isSearchable={false}
                    />
                </div>
                {dateRangePreset === 'custom' && (
                    <DatePickerRange
                        value={[
                            dayjs.unix(startDate).toDate(),
                            dayjs.unix(endDate).toDate(),
                        ]}
                        inputFormat={dateFormat}
                        size="sm"
                        onChange={handleDateChange}
                        dateViewCount={2}
                    />
                )}
                <Button size="sm" icon={<HiOutlineFilter />} onClick={onFilter}>
                    Apply
                </Button>
            </div>
        </div>
    )
}

export default AnalyticsDashboardHeader
