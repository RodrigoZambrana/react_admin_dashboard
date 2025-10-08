import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import {
    setStartDate,
    setEndDate,
    getExpensesDashboardData,
    useAppSelector,
    setDateRangePreset,
    DateRangePreset,
} from '../store'
import { useAppDispatch } from '@/store'
import { HiOutlineFilter } from 'react-icons/hi'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const dateFormat = 'MMM DD, YYYY'

const { DatePickerRange } = DatePicker

type RangeOption = {
    value: DateRangePreset
    label: string
}

const ExpensesDashboardHeader = () => {
    const dispatch = useAppDispatch()

    const startDate = useAppSelector(
        (state) => state.expensesDashboard.data.startDate,
    )
    const endDate = useAppSelector(
        (state) => state.expensesDashboard.data.endDate,
    )
    const dateRangePreset = useAppSelector(
        (state) => state.expensesDashboard.data.dateRangePreset,
    )

    const { t } = useTranslation()

    const rangeOptions: RangeOption[] = useMemo(
        () => [
            {
                value: 'today',
                label: t('expenses.dashboard.filters.range.options.today'),
            },
            {
                value: 'thisWeek',
                label: t('expenses.dashboard.filters.range.options.thisWeek'),
            },
            {
                value: 'thisMonth',
                label: t('expenses.dashboard.filters.range.options.thisMonth'),
            },
            {
                value: 'last15Days',
                label: t('expenses.dashboard.filters.range.options.last15Days'),
            },
            {
                value: 'thisYear',
                label: t('expenses.dashboard.filters.range.options.thisYear'),
            },
            {
                value: 'custom',
                label: t('expenses.dashboard.filters.range.options.custom'),
            },
        ],
        [t],
    )

    const resolvePresetRange = (preset: DateRangePreset): [number, number] => {
        const now = dayjs()
        switch (preset) {
            case 'today':
                return [
                    now.startOf('day').unix(),
                    now.endOf('day').unix(),
                ]
            case 'thisWeek':
                return [
                    now.startOf('week').unix(),
                    now.endOf('week').unix(),
                ]
            case 'thisMonth':
                return [
                    now.startOf('month').unix(),
                    now.endOf('month').unix(),
                ]
            case 'last15Days':
                return [
                    now.subtract(14, 'day').startOf('day').unix(),
                    now.endOf('day').unix(),
                ]
            case 'thisYear': {
                const yearStart = now.startOf('year').unix()
                const yearEnd = now.endOf('year').unix()
                return [yearStart, yearEnd]
            }
            case 'custom':
            default:
                return [startDate, endDate]
        }
    }

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
            dispatch(getExpensesDashboardData())
        }
    }

    const onFilter = () => {
        dispatch(getExpensesDashboardData())
    }

    const handleRangeChange = (option: RangeOption | null) => {
        const nextPreset = option?.value ?? 'custom'
        dispatch(setDateRangePreset(nextPreset))
        if (nextPreset !== 'custom') {
            const [nextStart, nextEnd] = resolvePresetRange(nextPreset)
            dispatch(setStartDate(nextStart))
            dispatch(setEndDate(nextEnd))
            dispatch(getExpensesDashboardData())
        }
    }

    const selectedOption =
        rangeOptions.find((option) => option.value === dateRangePreset) ??
        rangeOptions[0]

    return (
        <div className="lg:flex items-center justify-between mb-4 gap-3">
            <div className="mb-4 lg:mb-0">
                <h3>{t('expenses.dashboard.overview.title')}</h3>
                <p>{t('expenses.dashboard.overview.subtitle')}</p>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-gray-500">
                        {t('expenses.dashboard.filters.range.label')}
                    </span>
                    <Select<RangeOption>
                        options={rangeOptions}
                        value={selectedOption}
                        size="sm"
                        className="min-w-[160px]"
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
                    {t('text.actions.filter')}
                </Button>
            </div>
        </div>
    )
}

export default ExpensesDashboardHeader
