import { useEffect } from 'react'
import CalendarView from '@/components/shared/CalendarView'
import Container from '@/components/shared/Container'
import EventDialog, { EventParam } from './components/EventDialog'
import reducer, {
    getEvents,
    updateEvent,
    setSelected,
    openDialog,
    useAppDispatch,
    useAppSelector,
} from './store'
import { injectReducer } from '@/store'
import cloneDeep from 'lodash/cloneDeep'
import dayjs from 'dayjs'
import type { EventDropArg, EventClickArg, DateSelectArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { useTranslation } from 'react-i18next'

injectReducer('crmCalendar', reducer)

const Calendar = () => {
    const dispatch = useAppDispatch()
    const events = useAppSelector((state) => state.crmCalendar.data.eventList)
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
            }),
        )
        dispatch(openDialog())
    }

    const onEventClick = (arg: EventClickArg) => {
        const { start, end, id, title, extendedProps } = arg.event
        dispatch(
            setSelected({
                type: 'EDIT',
                eventColor: extendedProps.eventColor,
                title,
                start: dayjs(start).format(),
                end: end ? dayjs(end).format() : undefined,
                id,
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
            }),
        )
        dispatch(openDialog())
    }

    const onSubmit = (data: EventParam, type: string) => {
        let newEvents = cloneDeep(events)
        if (type === 'NEW') {
            newEvents.push(data)
        }

        if (type === 'EDIT') {
            newEvents = newEvents.map((event) => {
                if (data.id === event.id) {
                    event = data
                }
                return event
            })
        }
        dispatch(updateEvent(newEvents))
    }

    const onEventChange = (arg: EventDropArg) => {
        const newEvents = cloneDeep(events).map((event) => {
            if (arg.event.id === event.id) {
                const { id, extendedProps, start, end, title } = arg.event
                event = {
                    id,
                    start: dayjs(start).format(),
                    end: dayjs(end).format(),
                    title,
                    eventColor: extendedProps.eventColor,
                }
            }
            return event
        })
        dispatch(updateEvent(newEvents))
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
