import dayjs from 'dayjs'

export type DateRangePreset =
    | 'today'
    | 'last7Days'
    | 'last30Days'
    | 'last12Months'
    | 'custom'

export const resolvePresetRange = (preset: DateRangePreset) => {
    const now = dayjs()
    switch (preset) {
        case 'today':
            return [now.startOf('day').unix(), now.endOf('day').unix()] as const
        case 'last7Days':
            return [now.subtract(6, 'day').startOf('day').unix(), now.endOf('day').unix()] as const
        case 'last30Days':
            return [now.subtract(29, 'day').startOf('day').unix(), now.endOf('day').unix()] as const
        case 'last12Months':
            return [now.subtract(11, 'month').startOf('month').unix(), now.endOf('day').unix()] as const
        case 'custom':
        default:
            return [now.subtract(6, 'day').startOf('day').unix(), now.endOf('day').unix()] as const
    }
}

export const resolveComparisonRange = (startDate: number, endDate: number) => {
    const start = dayjs.unix(startDate).startOf('day')
    const end = dayjs.unix(endDate).endOf('day')
    const days = Math.max(1, end.startOf('day').diff(start, 'day') + 1)
    const compareEnd = start.subtract(1, 'day').endOf('day')
    const compareStart = compareEnd.subtract(days - 1, 'day').startOf('day')

    return {
        compareFrom: compareStart.unix(),
        compareTo: compareEnd.unix(),
    }
}

export const formatRangeLabel = (startDate: number, endDate: number) => {
    const start = dayjs.unix(startDate)
    const end = dayjs.unix(endDate)
    return `${start.format('MMM D, YYYY')} - ${end.format('MMM D, YYYY')}`
}

