import classNames from 'classnames'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { CalendarOptions } from '@fullcalendar/core'
import dayjs from 'dayjs'

type EventColors = Record<
    string,
    {
        bg: string
        text: string
        dot: string
    }
>

interface CalendarViewProps extends CalendarOptions {
    wrapperClass?: string
    eventColors?: (colors: EventColors) => EventColors
}

const defaultColorList: Record<
    string,
    {
        bg: string
        text: string
        dot: string
    }
> = {
    red: {
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-500 dark:text-red-100',
        dot: 'bg-red-500',
    },
    orange: {
        bg: 'bg-orange-50 dark:bg-orange-500/10',
        text: 'text-orange-500 dark:text-orange-100',
        dot: 'bg-orange-500',
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-500 dark:text-amber-100',
        dot: 'bg-amber-500',
    },
    yellow: {
        bg: 'bg-yellow-50 dark:bg-yellow-500/10',
        text: 'text-yellow-500 dark:text-yellow-100',
        dot: 'bg-yellow-500',
    },
    lime: {
        bg: 'bg-lime-50 dark:bg-lime-500/10',
        text: 'text-lime-500 dark:text-lime-100',
        dot: 'bg-lime-500',
    },
    green: {
        bg: 'bg-green-50 dark:bg-green-500/10',
        text: 'text-green-500 dark:text-green-100',
        dot: 'bg-green-500',
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-500 dark:text-emerald-100',
        dot: 'bg-emerald-500',
    },
    teal: {
        bg: 'bg-teal-50 dark:bg-teal-500/10',
        text: 'text-teal-500 dark:text-teal-100',
        dot: 'bg-teal-500',
    },
    cyan: {
        bg: 'bg-cyan-50 dark:bg-cyan-500/10',
        text: 'text-cyan-500 dark:text-cyan-100',
        dot: 'bg-cyan-500',
    },
    sky: {
        bg: 'bg-sky-50 dark:bg-sky-500/10',
        text: 'text-sky-500 dark:text-sky-100',
        dot: 'bg-sky-500',
    },
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-500 dark:text-blue-100',
        dot: 'bg-blue-500',
    },
    indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-500/10',
        text: 'text-indigo-500 dark:text-indigo-100',
        dot: 'bg-indigo-500',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-500/10',
        text: 'text-purple-500 dark:text-purple-100',
        dot: 'bg-purple-500',
    },
    fuchsia: {
        bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
        text: 'text-fuchsia-500 dark:text-fuchsia-100',
        dot: 'bg-fuchsia-500',
    },
    pink: {
        bg: 'bg-pink-50 dark:bg-pink-500/10',
        text: 'text-pink-500 dark:text-pink-100',
        dot: 'bg-pink-500',
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-500/10',
        text: 'text-rose-500 dark:text-rose-100',
        dot: 'bg-rose-500',
    },
}

const isHexColor = (value: string) =>
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)

const normalizeHex = (value: string) => {
    if (value.length === 4) {
        const [, r, g, b] = value
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
    }
    return value.toLowerCase()
}

const getReadableTextColor = (hex: string) => {
    const color = normalizeHex(hex)
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 150 ? '#1f2937' : '#ffffff'
}

const CalendarView = (props: CalendarViewProps) => {
    const {
        wrapperClass,
        eventColors = () => defaultColorList,
        ...rest
    } = props

    return (
        <div className={classNames('calendar', wrapperClass)}>
            <FullCalendar
                initialView="dayGridMonth"
                headerToolbar={{
                    left: 'title',
                    center: '',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay prev,next',
                }}
                eventContent={(arg) => {
                    const palette = eventColors(defaultColorList) || defaultColorList
                    const rawColor =
                        (arg.event.extendedProps as Record<string, unknown>)
                            ?.eventColor ??
                        (arg.event as unknown as { eventColor?: string })
                            .eventColor ??
                        (arg.event as unknown as { backgroundColor?: string })
                            .backgroundColor ??
                        (arg.event as unknown as { color?: string }).color ??
                        ''
                    const eventColorKey = String(rawColor || '')
                    const hexColor =
                        eventColorKey && isHexColor(eventColorKey)
                            ? normalizeHex(eventColorKey)
                            : undefined
                    const paletteColor =
                        eventColorKey && !hexColor
                            ? palette[eventColorKey]
                            : undefined
                    const { isEnd, isStart } = arg
                    const viewType =
                        ((arg as unknown as { view?: { type?: string } }).view?.type ?? '')
                    const isTimeGridView = viewType.startsWith('timeGrid')
                    const showLeading = !(isEnd && !isStart)
                    const textColor = hexColor ? getReadableTextColor(hexColor) : undefined
                    const eventStart = arg.event.start
                    const eventEnd = arg.event.end
                    const isAllDay = Boolean(arg.event.allDay)
                    const hasTime = Boolean(eventStart && !isAllDay)
                    const start = hasTime && eventStart ? dayjs(eventStart) : null
                    const end = hasTime && eventEnd ? dayjs(eventEnd) : null
                    const startTimeText = start ? start.format('HH:mm') : ''
                    const endTimeText =
                        start && end && !end.isSame(start, 'minute') ? end.format('HH:mm') : ''
                    const computedRangeText =
                        hasTime && (startTimeText || endTimeText)
                            ? `${startTimeText}${endTimeText ? ` - ${endTimeText}` : ''}`
                            : ''
                    const timeLabel = computedRangeText || arg.timeText || ''
                    const showDot = showLeading
                    const showTime = Boolean(
                        timeLabel && showDot && hasTime && (isTimeGridView || isStart),
                    )

                    return (
                        <div
                            className={classNames(
                                'custom-calendar-event flex gap-2',
                                !hexColor && paletteColor?.bg,
                                !hexColor && paletteColor?.text,
                                isEnd &&
                                    !isStart &&
                                    'rounded-tl-none! rounded-bl-none! !rtl:rounded-tr-none !rtl:rounded-br-none',
                                !isEnd &&
                                    isStart &&
                                    'rounded-tr-none! rounded-br-none! !rtl:rounded-tl-none !rtl:rounded-bl-none',
                                isTimeGridView
                                    ? 'h-full flex-col items-start gap-1'
                                    : 'items-start flex-wrap',
                            )}
                            style={{
                                ...(hexColor ? { backgroundColor: hexColor, color: textColor } : {}),
                                ...(isTimeGridView ? { height: '100%' } : {}),
                            }}
                        >
                            {showDot && (
                                <span
                                    className={classNames(
                                        'inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 border border-transparent',
                                        !hexColor && (paletteColor?.dot || 'bg-gray-400'),
                                    )}
                                    style={hexColor ? { backgroundColor: hexColor } : undefined}
                                />
                            )}
                            <div
                                className={classNames(
                                    'min-w-0 flex-1',
                                    isTimeGridView
                                        ? 'flex h-full flex-col gap-0.5 leading-tight'
                                        : 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-tight',
                                )}
                            >
                                {showTime && (
                                    <span
                                        className={classNames(
                                            'opacity-80',
                                            isTimeGridView ? 'text-[11px]' : 'text-xs',
                                        )}
                                    >
                                        {timeLabel}
                                    </span>
                                )}
                                <span
                                    className={classNames(
                                        'font-semibold whitespace-normal break-words',
                                        isTimeGridView ? 'text-sm leading-snug' : 'text-[13px]',
                                    )}
                                >
                                    {arg.event.title}
                                </span>
                            </div>
                        </div>
                    )
                }}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                {...rest}
            />
        </div>
    )
}

export default CalendarView
