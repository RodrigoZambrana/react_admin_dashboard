import { useEffect, useMemo, useState, useCallback } from 'react'
import Card from '@/components/ui/Card'
import Container from '@/components/shared/Container'
import Calendar from '@/components/ui/Calendar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import classNames from 'classnames'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import toast from '@/components/ui/toast'
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { type CalendarEventAddress, type CalendarEventDto } from '@/services/CustomersService'
import { apiSearchCalendarActivities } from '@/services/CalendarService'
import EventDialog from '@/views/crm/Calendar/components/EventDialog'
import calendarReducer, {
    openDialog as openCalendarDialog,
    setSelected as setCalendarSelected,
    useAppDispatch as useCalendarDispatch,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    type CalendarEvent,
} from '@/views/crm/Calendar/store'
import { injectReducer } from '@/store'

injectReducer('crmCalendar', calendarReducer)

const NAMED_COLOR_HEX_MAP: Record<string, string> = {
    blue: '#2563eb',
    purple: '#7c3aed',
    orange: '#f97316',
    red: '#ef4444',
    emerald: '#059669',
    cyan: '#06b6d4',
    amber: '#f59e0b',
    teal: '#0d9488',
    indigo: '#4f46e5',
    violet: '#8b5cf6',
    pink: '#ec4899',
    rose: '#f43f5e',
    slate: '#475569',
    gray: '#6b7280',
    neutral: '#737373',
}

const FALLBACK_COLOR = '#6b7280'

const normalizeColorToken = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z#]/g, ' ')
    const tokens = cleaned
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
    return tokens
}

const resolveHexColor = (value?: string) => {
    if (!value) {
        return FALLBACK_COLOR
    }
    const trimmed = value.trim()
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
        return trimmed
    }
    const tokens = normalizeColorToken(trimmed)
    for (const token of tokens) {
        if (NAMED_COLOR_HEX_MAP[token]) {
            return NAMED_COLOR_HEX_MAP[token]
        }
    }
    return FALLBACK_COLOR
}

const hexToRgb = (hex: string) => {
    const normalized = hex.replace('#', '')
    const value =
        normalized.length === 3
            ? normalized
                  .split('')
                  .map((char) => char + char)
                  .join('')
            : normalized
    const intValue = parseInt(value, 16)
    return {
        r: (intValue >> 16) & 255,
        g: (intValue >> 8) & 255,
        b: intValue & 255,
    }
}

const tintColor = (hex: string, ratio = 0.75) => {
    const { r, g, b } = hexToRgb(hex)
    const mix = (channel: number) =>
        Math.min(255, Math.round(channel + (255 - channel) * ratio))
    const tintedR = mix(r)
    const tintedG = mix(g)
    const tintedB = mix(b)
    return `rgb(${tintedR}, ${tintedG}, ${tintedB})`
}

type EventsByDate = Record<string, CalendarEventDto[]>
type CalendarActivityEvent = CalendarEventDto

type CalendarListItem = CalendarEventDto & {
    timeLabel: string
    detail: string
    location?: string
    addressLabel?: string
    typeLabel?: string
    customerId?: string
    sortOrder: number
    sortValue: number
    dateLabel: string
}

const hasTimeComponent = (iso: string) => iso.includes('T')

const hasAddressValue = (address?: CalendarEventAddress) => {
    if (!address) {
        return false
    }
    return [
        address.street,
        address.number,
        address.city,
        address.country,
        address.corner,
        address.apartment,
    ].some(
        (value) => value !== undefined && value !== null && String(value).trim() !== '',
    )
}

const formatAddressLabel = (address?: CalendarEventAddress) => {
    if (!address || !hasAddressValue(address)) {
        return ''
    }
    const line1 = [address.street, address.number]
        .filter((value) => value && String(value).trim() !== '')
        .join(' ')
    const line2 = [address.city, address.country]
        .filter((value) => value && String(value).trim() !== '')
        .join(', ')
    return [line1, line2]
        .filter((value) => value && String(value).trim() !== '')
        .join(', ')
}

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

const expandUpcomingOccurrences = (
    event: CalendarEventDto,
    labels: { allDayLabel: string; noDescription: string },
): CalendarListItem[] => {
    const baseItem = mapEventToListItem(event, labels)
    const occurrences: CalendarListItem[] = []
    const start = dayjs(event.start)
    if (!start.isValid()) {
        return occurrences
    }
    const endCandidate = event.end ? dayjs(event.end) : start
    const end = endCandidate.isBefore(start) ? start : endCandidate
    const today = dayjs().startOf('day')
    let cursor = start.startOf('day')
    const last = end.startOf('day')
    while (cursor.isBefore(last) || cursor.isSame(last)) {
        if (cursor.isAfter(today)) {
            const isFirstDay = cursor.isSame(start, 'day')
            const occurrenceStart = isFirstDay ? start : cursor.startOf('day')
            const normalizedStart = occurrenceStart.isValid()
                ? occurrenceStart
                : cursor.startOf('day')
            occurrences.push({
                ...baseItem,
                start: normalizedStart.toISOString(),
                sortValue: normalizedStart.valueOf(),
                sortOrder: isFirstDay ? baseItem.sortOrder : 0,
                dateLabel: cursor.format('DD/MM/YYYY'),
                timeLabel: isFirstDay ? baseItem.timeLabel : labels.allDayLabel,
            })
        }
        cursor = cursor.add(1, 'day')
    }
    return occurrences
}

const mapEventToListItem = (
    event: CalendarEventDto,
    labels: { allDayLabel: string; noDescription: string },
): CalendarListItem => {
    const start = dayjs(event.start)
    const end = event.end ? dayjs(event.end) : null
    const startIsValid = start.isValid()
    const endIsValid = Boolean(end?.isValid())
    const isAllDay = Boolean(event.allDay || !hasTimeComponent(event.start) || !startIsValid)
    const timeLabel = isAllDay
        ? labels.allDayLabel
        : end && endIsValid
        ? `${start.format('HH:mm')} - ${end.format('HH:mm')}`
        : startIsValid
        ? start.format('HH:mm')
        : labels.allDayLabel
    const addressLabel = formatAddressLabel(event.extendedProps?.address)
    const detail =
        event.extendedProps?.detail ||
        event.extendedProps?.location ||
        addressLabel ||
        labels.noDescription
    const location = event.extendedProps?.location
    const typeLabel = event.extendedProps?.type
    const customerId = event.extendedProps?.customerId
    const sortOrder = isAllDay ? 0 : 1
    const sortValue = startIsValid ? start.valueOf() : Number.MAX_SAFE_INTEGER
    const dateLabel = startIsValid ? start.format('DD/MM/YYYY') : ''

    return {
        ...event,
        timeLabel,
        detail,
        location,
        addressLabel,
        typeLabel,
        customerId,
        sortOrder,
        sortValue,
        dateLabel,
    }
}

const buildMetaLine = (item: CalendarListItem, fallback: string) => {
    const metaParts: string[] = []
    if (item.detail) {
        metaParts.push(item.detail)
    }
    if (item.location && item.location !== item.detail) {
        metaParts.push(item.location)
    }
    if (item.addressLabel && !metaParts.includes(item.addressLabel)) {
        metaParts.push(item.addressLabel)
    }
    return metaParts.length ? metaParts.join(' - ') : fallback
}

const CalendarActivities = () => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(dayjs().toDate())
    const [searchTerm, setSearchTerm] = useState('')
    const [allActivities, setAllActivities] = useState<CalendarEventDto[]>([])
    const [loading, setLoading] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const { textTheme } = useThemeClass()
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const calendarDispatch = useCalendarDispatch()
    const labels = useMemo(
        () => ({
            allDayLabel: t('calendar.allDay', { defaultValue: 'All day' }),
            noDescription: t('calendar.noDescription', {
                defaultValue: 'Sin descripción disponible',
            }),
        }),
        [t],
    )

    const eventsByDate = useMemo(
        () => buildEventsByDate(allActivities),
        [allActivities],
    )

    const mappedActivities = useMemo<CalendarListItem[]>(
        () => allActivities.map((event) => mapEventToListItem(event, labels)),
        [allActivities, labels],
    )

    useEffect(() => {
        let ignore = false

        const fetchActivities = async () => {
            setLoading(true)
            try {
                const data = await apiSearchCalendarActivities()
                if (!ignore) {
                    setAllActivities(data)
                }
            } catch {
                if (!ignore) {
                    setAllActivities([])
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
    }, [])


    const isToday = (someDate: Date) => dayjs(someDate).isSame(dayjs(), 'day')

    const eventsForDay = useMemo<CalendarListItem[]>(() => {
        if (!selectedDate) {
            return []
        }
        const key = dayjs(selectedDate).format('YYYY-MM-DD')
        const list = eventsByDate[key] || []
        return list
            .map((event) => mapEventToListItem(event, labels))
            .sort((a, b) => (a.sortOrder - b.sortOrder) || a.sortValue - b.sortValue)
    }, [eventsByDate, labels, selectedDate])

    const upcomingActivities = useMemo<CalendarListItem[]>(() => {
        if (allActivities.length === 0) {
            return []
        }
        const occurrences = allActivities.flatMap((event) =>
            expandUpcomingOccurrences(event, labels),
        )
        return occurrences
            .sort((a, b) => a.sortValue - b.sortValue)
            .slice(0, 20)
    }, [allActivities, labels])

    const upcomingActivityGroups = useMemo<
        { key: string; label: string; items: CalendarListItem[] }[]
    >(() => {
        if (!upcomingActivities.length) {
            return []
        }
        const groups = new Map<
            string,
            { label: string; items: CalendarListItem[] }
        >()
        upcomingActivities.forEach((item) => {
            const date = dayjs(item.start)
            const key = date.isValid()
                ? date.format('YYYY-MM-DD')
                : item.dateLabel || 'unknown'
            const label = date.isValid()
                ? date.locale(i18n.language).format('dddd, DD MMMM')
                : item.dateLabel ||
                  t('calendar.labels.unknownDate', {
                      defaultValue: 'Fecha sin determinar',
                  })
            if (!groups.has(key)) {
                groups.set(key, { label, items: [] })
            }
            groups.get(key)?.items.push(item)
        })
        return Array.from(groups.entries()).map(([key, value]) => ({
            key,
            label: value.label,
            items: value.items,
        }))
    }, [i18n.language, upcomingActivities, t])

    const searchResults = useMemo<CalendarListItem[]>(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) {
            return []
        }
        return mappedActivities
            .filter((item) => {
                const haystack = [
                    item.title,
                    item.detail,
                    item.location,
                    item.addressLabel,
                    item.typeLabel,
                    item.dateLabel,
                ]
                return haystack
                    .filter((value): value is string => Boolean(value && value.trim().length))
                    .some((value) => value.toLowerCase().includes(term))
            })
            .sort((a, b) => b.sortValue - a.sortValue)
            .slice(0, 50)
    }, [mappedActivities, searchTerm])

    const handleNavigate = (item: CalendarListItem) => {
        navigate(`/app/calendar/activities/details?id=${encodeURIComponent(item.id)}`)
    }

    const renderActivityItem = (
        item: CalendarListItem,
        {
            keyPrefix,
            showDateLabel = false,
            showActions = true,
        }: {
            keyPrefix: string
            showDateLabel?: boolean
            showActions?: boolean
        },
    ) => {
        const metaLine = buildMetaLine(item, labels.noDescription)
        const resolvedColor = resolveHexColor(item.eventColor)
        const tintedBackground = tintColor(resolvedColor, 0.82)
        const borderColor = tintColor(resolvedColor, 0.6)

        return (
            <div
                key={`${keyPrefix}-${item.id}-${item.start}`}
                className="flex items-center justify-between rounded-md mb-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-600/40 cursor-pointer user-select"
                onClick={() => handleNavigate(item)}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="rounded-lg h-10 w-10 flex items-center justify-center border"
                        style={{
                            backgroundColor: tintedBackground,
                            borderColor,
                        }}
                        aria-hidden="true"
                    />
                    <div className="flex flex-col gap-1">
                        <h6 className="text-sm font-semibold">{item.title}</h6>
                        {showDateLabel && item.dateLabel && (
                            <p className="text-xs text-gray-500 dark:text-gray-300">
                                {item.dateLabel}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-300">{metaLine}</p>
                    </div>
                </div>
                <div
                    className={classNames(
                        'flex items-center',
                        showActions ? 'gap-2' : undefined,
                    )}
                >
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                        {item.timeLabel}
                    </span>
                    {showActions && (
                        <Button
                            size="xs"
                            variant="plain"
                            icon={<HiOutlineTrash />}
                            loading={deletingId === item.id}
                            disabled={Boolean(deletingId && deletingId !== item.id)}
                            onClick={(event) => {
                                event.stopPropagation()
                                handleDeleteActivity(item)
                            }}
                            aria-label={t('text.actions.delete', {
                                defaultValue: 'Eliminar',
                            })}
                        />
                    )}
                </div>
            </div>
        )
    }

    const upsertActivity = useCallback((event: CalendarEventDto) => {
        setAllActivities((prev) => {
            const exists = prev.some((existing) => existing.id === event.id)
            if (exists) {
                return prev.map((existing) =>
                    existing.id === event.id ? event : existing,
                )
            }
            return [...prev, event]
        })
    }, [])

    const performDeleteActivity = async (item: CalendarListItem) => {
        try {
            setDeletingId(String(item.id))
            await calendarDispatch(deleteCalendarEvent(String(item.id))).unwrap()
            setAllActivities((prev) => prev.filter((event) => event.id !== item.id))
            toast.push(
                <Notification
                    type="success"
                    title={t('common.success', { defaultValue: 'Éxito' })}
                >
                    {t('calendar.messages.eventDeleted', {
                        defaultValue: 'Evento eliminado correctamente.',
                        title: item.title,
                    })}
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification
                    type="danger"
                    title={t('common.error', { defaultValue: 'Error' })}
                >
                    {t('calendar.errors.deleteFailed', {
                        defaultValue: 'No fue posible eliminar el evento.',
                    })}
                </Notification>,
            )
        } finally {
            setDeletingId(null)
        }
    }

    const handleDeleteActivity = (item: CalendarListItem) => {
        const message = t('calendar.confirmDelete', {
            defaultValue:
                '¿Eliminar el evento "{{title}}"? Esta acción no se puede deshacer.',
            title: item.title,
        })
        let toastKey: string | undefined

        const closeToast = () => {
            if (toastKey) {
                toast.remove(toastKey)
            }
        }

        const confirmDeletion = async () => {
            closeToast()
            await performDeleteActivity(item)
        }

        const cancelDeletion = () => {
            closeToast()
        }

        const notification = (
            <Notification
                type="warning"
                title={t('common.confirmation', {
                    defaultValue: 'Confirmación',
                })}
                duration={0}
                closable
            >
                <div className="space-y-3">
                    <p>{message}</p>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="plain" onClick={cancelDeletion}>
                            {t('text.actions.cancel', { defaultValue: 'Cancelar' })}
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            color="red"
                            onClick={confirmDeletion}
                            loading={deletingId === item.id}
                        >
                            {t('text.actions.delete', { defaultValue: 'Eliminar' })}
                        </Button>
                    </div>
                </div>
            </Notification>
        )

        const keyOrPromise = toast.push(notification, {
            placement: 'top-center',
            duration: 0,
        })

        if (keyOrPromise instanceof Promise) {
            keyOrPromise.then((key) => {
                toastKey = key
            })
        } else {
            toastKey = keyOrPromise
        }
    }

    const handleDialogSubmit = useCallback(
        async (eventData: CalendarEvent, type: string) => {
            try {
                const action =
                    type === 'EDIT'
                        ? updateCalendarEvent(eventData)
                        : createCalendarEvent(eventData)
                const result = await calendarDispatch(action).unwrap()
                if (result) {
                    upsertActivity(result)
                    if (type !== 'EDIT' && result.start) {
                        const resultDay = dayjs(result.start)
                        if (resultDay.isValid()) {
                            setSelectedDate(resultDay.toDate())
                        }
                    }
                }
            } catch {
                // Notifications handled at slice level
            }
        },
        [calendarDispatch, upsertActivity, setSelectedDate],
    )

    const handleDialogDelete = useCallback(
        async (id: string) => {
            try {
                await calendarDispatch(deleteCalendarEvent(String(id))).unwrap()
                setAllActivities((prev) => prev.filter((event) => event.id !== id))
            } catch {
                // Slice handles notifications
            }
        },
        [calendarDispatch],
    )

    const handleCreateActivity = () => {
        const baseDate = selectedDate ? dayjs(selectedDate) : dayjs()
        const now = dayjs()
        const startBase = baseDate.isSame(now, 'day')
            ? now
            : baseDate.hour(10).minute(0).second(0).millisecond(0)
        const start = startBase.second(0).millisecond(0)
        const end = start.add(1, 'hour')
        calendarDispatch(
            setCalendarSelected({
                type: 'NEW',
                start: start.format(),
                end: end.format(),
                allDay: false,
                extendedProps: {},
            }),
        )
        calendarDispatch(openCalendarDialog())
    }

    return (
        <Container>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="order-2 xl:order-2 xl:col-span-12">
                    <Card>
                        <h5 className="mb-4">
                            {t('calendar.calendarTitle', { defaultValue: 'Calendario' })}
                        </h5>
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
                                            <Badge className="absolute top-1" innerClass="h-1 w-1 bg-emerald-500" />
                                        )}
                                        {hasEvents && (
                                            <span className="absolute bottom-1 flex gap-[2px]">
                                                {dailyEvents.slice(0, 3).map((event, index) => {
                                                    const dotColor = resolveHexColor(event.eventColor)
                                                    return (
                                                        <span
                                                            key={`${key}-${event.id}-${index}`}
                                                            className="h-1.5 w-1.5 rounded-full border border-white/40 dark:border-white/10"
                                                            style={{ backgroundColor: dotColor }}
                                                        />
                                                    )
                                                })}
                                            </span>
                                        )}
                                    </span>
                                )
                            }}
                            onChange={(val) => setSelectedDate(val)}
                        />
                    </Card>
                </div>
                <div className="order-3 xl:order-3 xl:col-span-12">
                    <Card>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h5>
                                {t('calendar.activitiesTitle', {
                                    defaultValue: 'Actividades',
                                })}
                                {selectedDate && ` ${dayjs(selectedDate).format('DD/MM/YYYY')}`}
                                {` (${eventsForDay.length})`}
                            </h5>
                            <Button
                                size="sm"
                                variant="solid"
                                icon={<HiOutlinePlus />}
                                onClick={handleCreateActivity}
                            >
                                {t('calendar.actions.addActivity', {
                                    defaultValue: 'Nueva actividad',
                                })}
                            </Button>
                        </div>
                        {eventsForDay.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                                {t('calendar.noEventsForDay', {
                                    defaultValue: 'No hay actividades programadas para esta fecha.',
                                })}
                            </div>
                        ) : (
                            eventsForDay.map((item) =>
                                renderActivityItem(item, {
                                    keyPrefix: 'agenda',
                                }),
                            )
                        )}
                    </Card>
                </div>
                <div className="order-1 xl:order-1 xl:col-span-12">
                    <Card>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <h5>{t('calendar.searchTitle', { defaultValue: 'Buscar actividades' })}</h5>
                                <Input
                                    placeholder={t('calendar.placeholders.search', {
                                        defaultValue:
                                            'Buscar por título, fecha, cliente o contenido',
                                    })}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                                    <Spinner size={20} />
                                    {t('common.loading', {
                                        defaultValue: 'Cargando...',
                                    })}
                                </div>
                            ) : searchTerm.trim() ? (
                                searchResults.length ? (
                                    searchResults.slice(0, 20).map((item) =>
                                        renderActivityItem(item, {
                                            keyPrefix: 'search',
                                            showDateLabel: true,
                                            showActions: false,
                                        }),
                                    )
                                ) : (
                                    <div className="text-sm text-gray-500 dark:text-gray-300">
                                        {t('calendar.noSearchResults', {
                                            defaultValue:
                                                'No se encontraron actividades que coincidan con la búsqueda.',
                                        })}
                                    </div>
                                )
                            ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                    {t('calendar.messages.searchInstructions', {
                                        defaultValue:
                                            'Ingresa un término para buscar en todas las actividades.',
                                    })}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
                <div className="order-4 xl:order-4 xl:col-span-12">
                    <Card>
                        <h5 className="mb-4">
                            {t('calendar.upcomingActivities', {
                                defaultValue: 'Upcoming activities',
                            })}
                        </h5>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                                <Spinner size={20} />
                                {t('common.loading', { defaultValue: 'Cargando...' })}
                            </div>
                        ) : upcomingActivities.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                                {t('calendar.noUpcomingActivities', {
                                    defaultValue: 'No upcoming activities to display.',
                                })}
                            </div>
                        ) : (
                            upcomingActivityGroups.map((group) => (
                                <div key={group.key} className="mb-4 last:mb-0">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                                        {group.label}
                                    </div>
                                    <div className="mt-3 flex flex-col">
                                        {group.items.map((item) =>
                                            renderActivityItem(item, {
                                                keyPrefix: `upcoming-${group.key}`,
                                                showDateLabel: true,
                                                showActions: false,
                                            }),
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </Card>
                </div>
            </div>
            <EventDialog submit={handleDialogSubmit} onDelete={handleDialogDelete} />
        </Container>
    )
}

export default CalendarActivities
