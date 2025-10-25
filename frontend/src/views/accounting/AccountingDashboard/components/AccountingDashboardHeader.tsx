import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import {
    setStartDate,
    setEndDate,
    getAccountingDashboardData,
    setDateRangePreset,
    useAppSelector,
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

const AccountingDashboardHeader = () => {
    const dispatch = useAppDispatch()

    const fallbackStart = useMemo(
        () => dayjs().startOf('month').unix(),
        [],
    )
    const fallbackEnd = useMemo(() => dayjs().endOf('month').unix(), [])
    const startDate = useAppSelector(
        (state) =>
            state.accountingDashboard?.data?.startDate ?? fallbackStart,
    )
    const endDate = useAppSelector(
        (state) => state.accountingDashboard?.data?.endDate ?? fallbackEnd,
    )
    const dateRangePreset = useAppSelector(
        (state) =>
            state.accountingDashboard?.data?.dateRangePreset ?? 'thisMonth',
    )

    const { t } = useTranslation()

    const rangeOptions: RangeOption[] = useMemo(
        () => [
            {
                value: 'today',
                label: t('accounting.dashboard.filters.range.options.today', {
                    defaultValue: 'Hoy',
                }),
            },
            {
                value: 'thisWeek',
                label: t(
                    'accounting.dashboard.filters.range.options.thisWeek',
                    { defaultValue: 'Esta semana' },
                ),
            },
            {
                value: 'thisMonth',
                label: t(
                    'accounting.dashboard.filters.range.options.thisMonth',
                    { defaultValue: 'Este mes' },
                ),
            },
            {
                value: 'last15Days',
                label: t(
                    'accounting.dashboard.filters.range.options.last15Days',
                    { defaultValue: 'Últimos 15 días' },
                ),
            },
            {
                value: 'thisYear',
                label: t(
                    'accounting.dashboard.filters.range.options.thisYear',
                    { defaultValue: 'Este año' },
                ),
            },
            {
                value: 'custom',
                label: t(
                    'accounting.dashboard.filters.range.options.custom',
                    { defaultValue: 'Personalizado' },
                ),
            },
        ],
        [t],
    )

    const resolvePresetRange = (preset: DateRangePreset): [number, number] => {
        const now = dayjs()
        switch (preset) {
            case 'today':
                return [now.startOf('day').unix(), now.endOf('day').unix()]
            case 'thisWeek':
                return [now.startOf('week').unix(), now.endOf('week').unix()]
            case 'thisMonth':
                return [now.startOf('month').unix(), now.endOf('month').unix()]
            case 'last15Days':
                return [
                    now.subtract(14, 'day').startOf('day').unix(),
                    now.endOf('day').unix(),
                ]
            case 'thisYear':
                return [now.startOf('year').unix(), now.endOf('year').unix()]
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
            dispatch(getAccountingDashboardData())
        }
    }

    const onFilter = () => {
        dispatch(getAccountingDashboardData())
    }

    const handleRangeChange = (option: RangeOption | null) => {
        const nextPreset = option?.value ?? 'custom'
        dispatch(setDateRangePreset(nextPreset))
        if (nextPreset !== 'custom') {
            const [nextStart, nextEnd] = resolvePresetRange(nextPreset)
            dispatch(setStartDate(nextStart))
            dispatch(setEndDate(nextEnd))
            dispatch(getAccountingDashboardData())
        }
    }

    const selectedOption =
        rangeOptions.find((option) => option.value === dateRangePreset) ??
        rangeOptions[0]

    return (
        <div className="lg:flex items-center justify-between mb-4 gap-3">
            <div className="mb-4 lg:mb-0">
                <h3>
                    {t('accounting.dashboard.overview.title', {
                        defaultValue: 'Resumen de contabilidad',
                    })}
                </h3>
                <p>
                    {t('accounting.dashboard.overview.subtitle', {
                        defaultValue: 'Ventas, gastos e impuestos por mes',
                    })}
                </p>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-gray-500">
                        {t('accounting.dashboard.filters.range.label', {
                            defaultValue: 'Rango de fechas',
                        })}
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
                    {t('text.actions.filter', {
                        defaultValue: 'Filtrar',
                    })}
                </Button>
            </div>
        </div>
    )
}

export default AccountingDashboardHeader
