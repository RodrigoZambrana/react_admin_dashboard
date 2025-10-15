import { useCallback, useEffect, useState } from 'react'
import CalendarView from '@/components/shared/CalendarView'
import Container from '@/components/shared/Container'
import EventDialog from './components/EventDialog'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import reducer, {
    getEvents,
    setSelected,
    openDialog,
    useAppDispatch,
    useAppSelector,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    CalendarEvent,
} from './store'
import { injectReducer } from '@/store'
import dayjs, { type Dayjs } from 'dayjs'
import type { EventDropArg, EventClickArg, DateSelectArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { useTranslation } from 'react-i18next'

injectReducer('crmCalendar', reducer)

type MobileDayDialogState = {
    date: Dayjs
    events: CalendarEvent[]
    viewType: string
}

const Calendar = () => {
    const dispatch = useAppDispatch()
    const eventsState = useAppSelector(
        (state) => state.crmCalendar.data.eventList,
    )
    const events = Array.isArray(eventsState) ? eventsState : []
    const { t, i18n } = useTranslation()
    const fcLocale = i18n.language && i18n.language.startsWith('es') ? 'es' : 'en'
    const [isMobile, setIsMobile] = useState(false)
    const [mobileDayDialog, setMobileDayDialog] = useState<MobileDayDialogState | null>(null)

    useEffect(() => {
        dispatch(getEvents())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return
        }
        const media = window.matchMedia('(max-width: 768px)')
        const handleChange = (event: MediaQueryListEvent) => {
            setIsMobile(event.matches)
        }
        setIsMobile(media.matches)
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', handleChange)
            return () => media.removeEventListener('change', handleChange)
        }
        media.addListener(handleChange)
        return () => media.removeListener(handleChange)
    }, [])

    const showNewEventDialog = useCallback(
        (start: Dayjs, end?: Dayjs, allDay = false) => {
            const baseStart = start?.isValid?.() ? start : dayjs()
            const normalizedStart = baseStart.isValid() ? baseStart : dayjs()
            const normalizedEnd =
                end && end.isValid()
                    ? end
                    : normalizedStart.add(1, 'hour')
            dispatch(
                setSelected({
                    type: 'NEW',
                    start: normalizedStart.format(),
                    end: normalizedEnd.format(),
                    allDay,
                }),
            )
            dispatch(openDialog())
        },
        [dispatch],
    )

    const dispatchEditSelection = useCallback(
        (event: CalendarEvent) => {
            const extendedProps = {
                ...(event.extendedProps || {}),
            }
            const rawEventTypeId =
                (extendedProps.eventTypeId as string | number | undefined) ??
                event.eventTypeId
            const normalizedEventTypeId =
                rawEventTypeId === undefined || rawEventTypeId === null
                    ? undefined
                    : String(rawEventTypeId)
            const startDate = dayjs(event.start)
            const endDate = event.end ? dayjs(event.end) : undefined
            const safeStart = startDate.isValid() ? startDate : dayjs()
            const safeEnd =
                endDate && endDate.isValid()
                    ? endDate
                    : undefined
            const resolvedColor =
                (typeof extendedProps.eventColor === 'string' && extendedProps.eventColor) ||
                event.eventColor ||
                undefined
            const resolvedTitle =
                event.title && event.title.trim().length
                    ? event.title
                    : t('calendar.labels.untitled', {
                          defaultValue: 'Evento sin título',
                      })
            dispatch(
                setSelected({
                    type: 'EDIT',
                    eventColor: resolvedColor,
                    title: resolvedTitle,
                    start: safeStart.format(),
                    end: safeEnd?.format(),
                    id: event.id,
                    allDay: Boolean(event.allDay),
                    eventTypeId: normalizedEventTypeId,
                    extendedProps,
                }),
            )
            dispatch(openDialog())
        },
        [dispatch, t],
    )

    const findEventsForDay = useCallback(
        (targetDate: Dayjs) => {
            const dayStart = targetDate.startOf('day').valueOf()
            const dayEnd = targetDate.endOf('day').valueOf()
            return events.filter((event) => {
                const startDate = dayjs(event.start)
                if (!startDate.isValid()) {
                    return false
                }
                const startMs = startDate.valueOf()
                const endDate = event.end ? dayjs(event.end) : null
                const endMs = endDate?.isValid() ? endDate.valueOf() : startMs
                const safeEndMs = endMs < startMs ? startMs : endMs
                return startMs <= dayEnd && safeEndMs >= dayStart
            })
        },
        [events],
    )

    const tryOpenMobileDayDialog = useCallback(
        (targetDate: Dayjs, viewType: string) => {
            if (!isMobile || viewType !== 'dayGridMonth') {
                return false
            }
            const dayEvents = findEventsForDay(targetDate)
            if (dayEvents.length === 0) {
                return false
            }
            const sorted = dayEvents
                .slice()
                .sort(
                    (a, b) =>
                        dayjs(a.start).valueOf() - dayjs(b.start).valueOf(),
                )
            setMobileDayDialog({
                date: targetDate.startOf('day'),
                events: sorted,
                viewType,
            })
            return true
        },
        [findEventsForDay, isMobile],
    )

    const closeMobileDayDialog = useCallback(() => {
        setMobileDayDialog(null)
    }, [])

    const resolveEventColor = useCallback((event: CalendarEvent) => {
        const fromExtended = event.extendedProps?.eventColor
        if (typeof fromExtended === 'string' && fromExtended.trim().length) {
            return fromExtended
        }
        if (typeof event.eventColor === 'string' && event.eventColor.trim().length) {
            return event.eventColor
        }
        return '#2563eb'
    }, [])

    const formatEventTimeRange = useCallback(
        (event: CalendarEvent) => {
            const startDate = dayjs(event.start)
            if (!startDate.isValid()) {
                return t('calendar.allDay', { defaultValue: 'Todo el día' })
            }
            if (event.allDay) {
                return t('calendar.allDay', { defaultValue: 'Todo el día' })
            }
            const endDate = event.end ? dayjs(event.end) : null
            if (endDate?.isValid()) {
                const startLabel = startDate.format('HH:mm')
                const endLabel = endDate.format('HH:mm')
                return startLabel === endLabel
                    ? startLabel
                    : `${startLabel} - ${endLabel}`
            }
            return startDate.format('HH:mm')
        },
        [t],
    )

    const handleMobileEventEdit = useCallback(
        (eventId: string) => {
            const source =
                events.find((evt) => String(evt.id) === String(eventId)) ||
                mobileDayDialog?.events.find(
                    (evt) => String(evt.id) === String(eventId),
                )
            if (!source) {
                closeMobileDayDialog()
                return
            }
            dispatchEditSelection(source)
            closeMobileDayDialog()
        },
        [closeMobileDayDialog, dispatchEditSelection, events, mobileDayDialog],
    )

    const handleMobileCreate = useCallback(() => {
        if (!mobileDayDialog) {
            return
        }
        const baseDate = mobileDayDialog.date
        const now = dayjs()
        const defaultBase = baseDate
            .hour(10)
            .minute(0)
            .second(0)
            .millisecond(0)
        const base = baseDate.isSame(now, 'day') ? now : defaultBase
        showNewEventDialog(base, base.add(1, 'hour'), false)
        closeMobileDayDialog()
    }, [closeMobileDayDialog, mobileDayDialog, showNewEventDialog])

    const onCellSelect = (event: DateSelectArg) => {
        const viewType = String(event.view?.type || '')
        const start = dayjs(event.start)
        if (!start.isValid()) {
            return
        }

        if (tryOpenMobileDayDialog(start, viewType)) {
            return
        }

        const end = event.end ? dayjs(event.end) : undefined
        showNewEventDialog(start, end, Boolean(event.allDay))
    }

    const onEventClick = (arg: EventClickArg) => {
        const { start, end, id, title } = arg.event
        const fcExtendedProps = (arg.event.extendedProps || {}) as Record<string, unknown>
        const eventData = events.find((evt) => String(evt.id) === String(id))
        const startDate = dayjs(start)
        const endDate = end ? dayjs(end) : undefined
        const mergedEvent: CalendarEvent = {
            ...(eventData || {
                id: String(id),
                title: title || '',
                start: startDate.isValid() ? startDate.format() : dayjs().format(),
                eventColor: '',
            }),
            id: String(id),
            title: title || eventData?.title || '',
            start: startDate.isValid()
                ? startDate.format()
                : eventData?.start || dayjs().format(),
            end: endDate?.isValid()
                ? endDate.format()
                : eventData?.end,
            allDay: eventData?.allDay ?? arg.event.allDay ?? false,
            eventColor:
                (fcExtendedProps.eventColor as string | undefined) ??
                eventData?.eventColor ??
                ((arg.event as any).backgroundColor as string | undefined) ??
                '',
            eventTypeId:
                (fcExtendedProps.eventTypeId as string | undefined) ??
                eventData?.eventTypeId,
            extendedProps: {
                ...(eventData?.extendedProps || {}),
                ...fcExtendedProps,
            },
        }
        dispatchEditSelection(mergedEvent)
    }

    const onDateClick = (arg: DateSelectArg | { date: Date; view: any }) => {
        const viewType = String((arg as any)?.view?.type || '')
        const clicked = dayjs((arg as any).date || (arg as any).start)
        if (!clicked.isValid()) {
            return
        }

        if (tryOpenMobileDayDialog(clicked, viewType)) {
            return
        }

        const isTimeGrid = viewType.startsWith('timeGrid')
        const now = dayjs()
        const defaultBase = clicked
            .hour(10)
            .minute(0)
            .second(0)
            .millisecond(0)
        const base = isTimeGrid
            ? clicked
            : clicked.isSame(now, 'day')
            ? now
            : defaultBase
        showNewEventDialog(base, base.add(1, 'hour'), false)
    }

    const onSubmit = (data: CalendarEvent, type: string) => {
        if (type === 'EDIT') {
            dispatch(updateCalendarEvent(data))
        } else {
            dispatch(createCalendarEvent(data))
        }
    }

    const onDelete = (id: string) => dispatch(deleteCalendarEvent(id)).unwrap()

    const onEventChange = (arg: EventDropArg) => {
        const existing = events.find((event) => event.id === arg.event.id)
        if (!existing) {
            return
        }
        const updated: CalendarEvent = {
            ...existing,
            start: dayjs(arg.event.start).format(),
            end: arg.event.end ? dayjs(arg.event.end).format() : undefined,
            allDay: Boolean(arg.event.allDay ?? existing.allDay),
        }
        dispatch(updateCalendarEvent(updated))
    }

    return (
        <Container className="h-full">
            <CalendarView
                wrapperClass="calendar--expanded"
                height="auto"
                contentHeight="auto"
                expandRows
                dayMaxEventRows={6}
                dayMaxEvents
                editable
                selectable={!isMobile}
                events={events}
                eventClick={onEventClick}
                select={!isMobile ? onCellSelect : undefined}
                dateClick={(arg: any) => onDateClick(arg)}
                longPressDelay={0}
                selectLongPressDelay={isMobile ? 500 : 0}
                slotDuration={{ minutes: 10 }}
                snapDuration={{ minutes: 10 }}
                buttonText={{ month: t('calendar.month'), week: t('calendar.week'), day: t('calendar.day') }}
                locales={[esLocale]}
                locale={fcLocale}
                eventDrop={onEventChange}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            />
            <EventDialog submit={onSubmit} onDelete={onDelete} />
            <Dialog
                isOpen={Boolean(mobileDayDialog)}
                onClose={closeMobileDayDialog}
                onRequestClose={closeMobileDayDialog}
            >
                {mobileDayDialog && (
                    <div className="space-y-4">
                        <div>
                            <h5 className="text-base font-semibold">
                                {t('calendar.mobileDayDialog.title', {
                                    defaultValue: 'Eventos del día',
                                })}
                            </h5>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                {mobileDayDialog.date.format('DD/MM/YYYY')}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t('calendar.mobileDayDialog.subtitle', {
                                    defaultValue: 'Selecciona un evento para editarlo o crea uno nuevo.',
                                })}
                            </p>
                        </div>
                        <div className="space-y-3">
                            {mobileDayDialog.events.map((event) => {
                                const color = resolveEventColor(event)
                                return (
                                    <div
                                        key={event.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleMobileEventEdit(String(event.id))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                handleMobileEventEdit(String(event.id))
                                            }
                                        }}
                                        className="flex items-start justify-between gap-3 rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-primary-400"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">
                                                    {event.title ||
                                                        t('calendar.labels.untitled', {
                                                            defaultValue: 'Evento sin título',
                                                        })}
                                                </p>
                                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                                                    {formatEventTimeRange(event)}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold uppercase text-primary-600 dark:text-primary-300">
                                            {t('text.actions.edit', { defaultValue: 'Editar' })}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button size="sm" variant="plain" onClick={closeMobileDayDialog}>
                                {t('text.actions.close', { defaultValue: 'Cerrar' })}
                            </Button>
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={handleMobileCreate}
                            >
                                {t('calendar.actions.addActivity', {
                                    defaultValue: 'Nueva actividad',
                                })}
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>
        </Container>
    )
}

export default Calendar
