import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Container from '@/components/shared/Container'
import Calendar from '@/components/ui/Calendar'
import Badge from '@/components/ui/Badge'
import classNames from 'classnames'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import useQuery from '@/utils/hooks/useQuery'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import type { CalendarEventDto } from '@/services/CrmService'
import { apiSearchCalendarActivities } from '@/services/CalendarService'

const colorVariants: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-100',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-100',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-100',
    red: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-100',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-100',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100',
    teal: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-100',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-100',
}

const dotVariants: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
}

const defaultColorVariant =
    'bg-gray-100 text-gray-600 dark:bg-gray-600/40 dark:text-gray-100'
const defaultDotVariant = 'bg-gray-400'

type EventsByDate = Record<string, CalendarEventDto[]>

type CalendarListItem = CalendarEventDto & {
    timeLabel: string
    detail: string
    location?: string
    typeLabel?: string
    customerId?: string
    sortOrder: number
    sortValue: number
}

const hasTimeComponent = (iso: string) => iso.includes('T')

const buildEventsByDate = (events: CalendarActivityEvent[]): EventsByDate => {
    const record: EventsByDate = {}
    events.forEach((event) => {
        const start = dayjs(event.start)
        if (!start.isValid()) {
            return
        }
        const endCandidate = event.end ? dayjs(event.end) : start
        const end = endCandidate.isBefore(start) ? start : endCandidate
        let cursor = start.startOf('day')
        const last = end.startOf('day')
        while (cursor.isBefore(last) || cursor.isSame(last)) {
            const key = cursor.format('YYYY-MM-DD')
            if (!record[key]) {
                record[key] = []
            }
            record[key].push(event)
            if (cursor.isSame(last)) {
                break
            }
            cursor = cursor.add(1, 'day')
        }
    })
    return record
}

const CalendarActivities = () => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(dayjs().toDate())
    const [searchTerm, setSearchTerm] = useState('')
    const [activities, setActivities] = useState<CalendarEventDto[]>([])
    const [loading, setLoading] = useState(false)
    const { textTheme } = useThemeClass()
    const { t } = useTranslation()
    const query = useQuery()
    const navigate = useNavigate()

    const eventsByDate = useMemo(
        () => buildEventsByDate(activities),
        [activities],
    )

    useEffect(() => {
        let ignore = false

        const fetchActivities = async () => {
            setLoading(true)
            try {
                const params = searchTerm ? { q: searchTerm } : undefined
                const data = await apiSearchCalendarActivities(params)
                if (!ignore) {
                    setActivities(data)
                }
            } catch (error) {
                if (!ignore) {
                    setActivities([])
                }
            } finally {
                if (!ignore) {
                    setLoading(false)
                }
            }
        }

        fetchActivities()

        return () => {
            ignore = true
        }
    }, [searchTerm])

    useEffect(() => {
        const q = query.get('date')
        if (q) {
            const d = dayjs(q, ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY'], true)
            if (d.isValid()) {
                setSelectedDate(d.toDate())
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const isToday = (someDate: Date) => dayjs(someDate).isSame(dayjs(), 'day')

    const eventsForDay = useMemo<CalendarListItem[]>(() => {
        if (!selectedDate) {
            return []
        }
        const key = dayjs(selectedDate).format('YYYY-MM-DD')
        const list = eventsByDate[key] || []
        const allDayLabel = t('calendar.allDay', { defaultValue: 'All day' })
        const noDescription = t('calendar.noDescription', {
            defaultValue: 'Sin descripcion disponible',
        })
        return list
            .map((event) => {
                const start = dayjs(event.start)
                const end = event.end ? dayjs(event.end) : undefined
                const isAllDay = Boolean(event.allDay || !hasTimeComponent(event.start))
                const timeLabel = isAllDay
                    ? allDayLabel
                    : end
                    ? `${start.format('HH:mm')} - ${end.format('HH:mm')}`
                    : start.format('HH:mm')
                const detail =
                    event.extendedProps?.detail ||
                    event.extendedProps?.location ||
                    noDescription
                const location = event.extendedProps?.location
                const typeLabel = event.extendedProps?.type
                const customerId = event.extendedProps?.customerId
                return {
                    ...event,
                    timeLabel,
                    detail,
                    location,
                    typeLabel,
                    customerId,
                    sortOrder: isAllDay ? 0 : 1,
                    sortValue: start.valueOf(),
                }
            })
            .sort((a, b) => (a.sortOrder - b.sortOrder) || a.sortValue - b.sortValue)
    }, [eventsByDate, selectedDate, t])

    const handleNavigate = (item: CalendarListItem) => {
        const queryParams = new URLSearchParams({ id: item.id })
        if (item.customerId) {
            queryParams.set('customerId', String(item.customerId))
        }
        if (selectedDate) {
            queryParams.set('date', dayjs(selectedDate).format('YYYY-MM-DD'))
        }
        navigate(`/app/calendar/activities/details?${queryParams.toString()}`)
    }

    return (
        <Container>
            <div className="flex flex-col gap-4">
                <Card className="mb-0">
                    <div className="mx-auto max-w-[700px] w-full">
                        <div className="flex flex-col gap-3 mb-4">
                            <Input
                                placeholder={t('calendar.placeholders.search', {
                                    defaultValue:
                                        'Buscar por título, fecha, cliente o contenido',
                                })}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {loading && (
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                                    <Spinner size={20} />
                                    {t('common.loading', { defaultValue: 'Cargando...' })}
                                </div>
                            )}
                        </div>
                        <Calendar
                            value={selectedDate}
                            dayClassName={(date, { selected }) => {
                                const base = 'text-base'
                                if (isToday(date) && !selected) {
                                    return classNames(base, textTheme)
                                }
                                if (selected) {
                                    return classNames(base, 'text-white')
                                }
                                return base
                            }}
                            dayStyle={() => ({ height: 48 })}
                            renderDay={(date) => {
                                const day = date.getDate()
                                const key = dayjs(date).format('YYYY-MM-DD')
                                const dailyEvents = eventsByDate[key] || []
                                const hasEvents = dailyEvents.length > 0
                                return (
                                    <span className="relative flex justify-center items-center w-full h-full">
                                        {day}
                                        {isToday(date) && (
                                            <Badge
                                                className="absolute top-1"
                                                innerClass="h-1 w-1"
                                            />
                                        )}
                                        {hasEvents && (
                                            <span className="absolute bottom-1 flex gap-[2px]">
                                                {dailyEvents.slice(0, 3).map((event, index) => (
                                                    <span
                                                        key={`${key}-${event.id}-${index}`}
                                                        className={classNames(
                                                            'h-1.5 w-1.5 rounded-full',
                                                            dotVariants[event.eventColor] ||
                                                                defaultDotVariant,
                                                        )}
                                                    />
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                )
                            }}
                            onChange={(val) => setSelectedDate(val)}
                        />
                    </div>
                </Card>
                <Card>
                    <h5 className="mb-4">
                        {t('text.titles.schedule')}
                        {selectedDate && ` - ${dayjs(selectedDate).format('DD/MM/YYYY')}`}
                        {` (${eventsForDay.length})`}
                    </h5>
                    {eventsForDay.length === 0 ? (
                        <div className="text-sm text-gray-500 dark:text-gray-300">
                            {searchTerm
                                ? t('calendar.noEventsForDaySearch', {
                                      defaultValue:
                                          'No hay actividades que coincidan con la búsqueda para esta fecha.',
                                  })
                                : t('calendar.noEventsForDay', {
                                      defaultValue:
                                          'No hay actividades programadas para esta fecha.',
                                  })}
                        </div>
                    ) : (
                        eventsForDay.map((item) => {
                            const metaParts: string[] = []
                            if (item.detail) {
                                metaParts.push(item.detail)
                            }
                            if (item.location && item.location !== item.detail) {
                                metaParts.push(item.location)
                            }
                            const metaLine = metaParts.length
                                ? metaParts.join(' - ')
                                : t('calendar.noDescription', {
                                      defaultValue: 'Sin descripción disponible',
                                  })
                            const colorClass =
                                colorVariants[item.eventColor] || defaultColorVariant
                            const iconLabel = (item.typeLabel || item.title)
                                .slice(0, 2)
                                .toUpperCase()
                            return (
                                <div
                                    key={`${item.id}-${item.start}`}
                                    className="flex items-center justify-between rounded-md mb-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-600/40 cursor-pointer user-select"
                                    onClick={() => handleNavigate(item)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={classNames(
                                                'rounded-lg h-10 w-10 text-xs font-semibold flex items-center justify-center uppercase tracking-wide',
                                                colorClass,
                                            )}
                                        >
                                            {iconLabel}
                                        </div>
                                        <div>
                                            <h6 className="text-sm font-semibold">
                                                {item.title}
                                            </h6>
                                            <p className="text-xs text-gray-500 dark:text-gray-300">
                                                {metaLine}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                                        {item.timeLabel}
                                    </span>
                                </div>
                            )
                        })
                    )}
                </Card>
            </div>
        </Container>
    )
}

export default CalendarActivities
