import { useEffect } from 'react'
import CalendarView from '@/components/shared/CalendarView'
import Container from '@/components/shared/Container'
import EventDialog from './components/EventDialog'
import reducer, {
    getEvents,
    setSelected,
    openDialog,
    useAppDispatch,
    useAppSelector,
    createCalendarEvent,
    updateCalendarEvent,
    CalendarEvent,
} from './store'
import { injectReducer } from '@/store'
import dayjs from 'dayjs'
import type { EventDropArg, EventClickArg, DateSelectArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { useTranslation } from 'react-i18next'

injectReducer('crmCalendar', reducer)

const Calendar = () => {
    const dispatch = useAppDispatch()
    const eventsState = useAppSelector(
        (state) => state.crmCalendar.data.eventList,
    )
    const events = Array.isArray(eventsState) ? eventsState : []
    const { t, i18n } = useTranslation()
    const fcLocale = i18n.language && i18n.language.startsWith('es') ? 'es' : 'en'

    useEffect(() => {
        dispatch(getEvents())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onCellSelect = (event: DateSelectArg) => {
        // Respect the range selected by FullCalendar when available
        const start = dayjs(event.start)
        const end = event.end ? dayjs(event.end) : start.add(1, 'hour')
        dispatch(
            setSelected({
                type: 'NEW',
                start: start.format(),
                end: end.format(),
                allDay: false,
            }),
        )
        dispatch(openDialog())
    }

    const onEventClick = (arg: EventClickArg) => {
        const { start, end, id, title } = arg.event
        const eventData = events.find((evt) => evt.id === id)
        const extendedProps = {
            ...(eventData?.extendedProps || {}),
            ...(arg.event.extendedProps as Record<string, unknown>),
        }
        dispatch(
            setSelected({
                type: 'EDIT',
                eventColor:
                    (extendedProps.eventColor as string | undefined) ||
                    eventData?.eventColor,
                title,
                start: dayjs(start).format(),
                end: end ? dayjs(end).format() : undefined,
                id,
                allDay: eventData?.allDay ?? arg.event.allDay ?? false,
                extendedProps,
            }),
        )
        dispatch(openDialog())
    }

    const onDateClick = (arg: DateSelectArg | { date: Date; view: any }) => {
        // Create 1-hour events precisely at clicked slot for timeGrid (week/day)
        // For month view, default to 10:00 of that day
        const isTimeGrid = (arg as any)?.view?.type?.startsWith('timeGrid')
        const clicked = dayjs((arg as any).date || (arg as any).start)
        const isToday = clicked.isSame(dayjs(), 'day')
        const base = isTimeGrid
            ? clicked
            : isToday
            ? dayjs()
            : clicked.hour(10).minute(0).second(0).millisecond(0)
        const end = base.add(1, 'hour')
        dispatch(
            setSelected({
                type: 'NEW',
                start: base.format(),
                end: end.format(),
                allDay: false,
            }),
        )
        dispatch(openDialog())
    }

    const onSubmit = (data: CalendarEvent, type: string) => {
        if (type === 'EDIT') {
            dispatch(updateCalendarEvent(data))
        } else {
            dispatch(createCalendarEvent(data))
        }
    }

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
                editable
                selectable
                events={events}
                eventClick={onEventClick}
                select={onCellSelect}
                dateClick={(arg: any) => onDateClick(arg)}
                longPressDelay={0}
                selectLongPressDelay={0}
                slotDuration={{ minutes: 10 }}
                snapDuration={{ minutes: 10 }}
                buttonText={{ month: t('calendar.month'), week: t('calendar.week'), day: t('calendar.day') }}
                locales={[esLocale]}
                locale={fcLocale}
                eventDrop={onEventChange}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            />
            <EventDialog submit={onSubmit} />
        </Container>
    )
}

export default Calendar
