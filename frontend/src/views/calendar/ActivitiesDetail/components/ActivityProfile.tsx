import { ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tag from '@/components/ui/Tag'
import {
    HiPencilAlt,
    HiOutlineCalendar,
    HiOutlineClock,
    HiOutlineLocationMarker,
    HiOutlineSwitchHorizontal,
} from 'react-icons/hi'
import dayjs from 'dayjs'

type MetaTileProps = {
    icon: ReactNode
    label: string
    value?: ReactNode
}

const MetaTile = ({ icon, label, value }: MetaTileProps) => (
    <div className="rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/75 dark:bg-gray-800/60 backdrop-blur px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
            <span className="mt-1 text-primary-600 dark:text-primary-400">{icon}</span>
            <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {label}
                </span>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                    {value ?? '-'}
                </div>
            </div>
        </div>
    </div>
)

type ActivityProfileProps = {
    data?: Partial<{
        id: string
        name?: string
        eventType?: string
        role?: string
        startAt?: string
        endAt?: string
        allDay?: boolean
        time?: string
        eventColor?: string
        personalInfo?: {
            location?: string
        }
        address?: {
            street?: string
            number?: string
            corner?: string
            apartment?: string
            city?: string
            country?: string
        }
    }>
    onEdit?: () => void
}

const ActivityProfile = ({ data = {}, onEdit }: ActivityProfileProps) => {
    const { t } = useTranslation()

    const start = data.startAt ? dayjs(data.startAt) : null
    const end = data.endAt ? dayjs(data.endAt) : null

    const eventAccent = useMemo(() => {
        const fallback = '#2563eb'
        const hex = (data.eventColor || fallback).trim() || fallback
        const normalizeHex = (value: string) => {
            const cleaned = value.replace('#', '')
            if (cleaned.length === 3) {
                return cleaned
                    .split('')
                    .map((char) => char + char)
                    .join('')
            }
            if (cleaned.length === 6) {
                return cleaned
            }
            return fallback.replace('#', '')
        }
        const toRgb = (value: string) => {
            const normalized = normalizeHex(value)
            const intValue = parseInt(normalized, 16)
            const r = (intValue >> 16) & 255
            const g = (intValue >> 8) & 255
            const b = intValue & 255
            return { r, g, b }
        }
        const toRgba = (value: string, alpha: number) => {
            const { r, g, b } = toRgb(value)
            return `rgba(${r}, ${g}, ${b}, ${alpha})`
        }
        const normalizedHex = normalizeHex(hex)
        return {
            color: `#${normalizedHex}`,
            background: toRgba(normalizedHex, 0.12),
            border: toRgba(normalizedHex, 0.28),
        }
    }, [data.eventColor])

    const dateLabel = useMemo(() => {
        if (!start) {
            return '-'
        }
        if (end && !start.isSame(end, 'day')) {
            return `${start.format('DD/MM/YYYY')} → ${end.format('DD/MM/YYYY')}`
        }
        return start.format('DD/MM/YYYY')
    }, [start, end])

    const timeLabel = useMemo(() => {
        if (data.allDay) {
            return t('calendar.fields.allDay', {
                defaultValue: 'Evento de todo el día',
            })
        }
        if (start) {
            const startTime = start.format('HH:mm')
            const endTime = end ? end.format('HH:mm') : ''
            return endTime ? `${startTime} - ${endTime}` : startTime
        }
        return data.time || '-'
    }, [data.allDay, data.time, end, start, t])

    const eventTypeLabel = useMemo(() => {
        const role = (data.role || '').toLowerCase()
        const fallback = data.eventType || data.role || '-'
        if (!role) {
            return fallback
        }
        return t(`calendar.eventTypes.${role}`, {
            defaultValue: fallback,
        })
    }, [data.eventType, data.role, t])

    const location = data.personalInfo?.location
    const addressLines = useMemo(() => {
        if (!data.address) {
            return []
        }
        const streetParts = [data.address.street, data.address.number]
            .map((value) => (value ? String(value).trim() : ''))
            .filter((value) => value.length)
        const apartment = data.address.apartment ? String(data.address.apartment).trim() : ''
        const streetLine = [streetParts.join(' '), apartment ? `Apt ${apartment}` : '']
            .filter((value) => value.length)
            .join(' ')
            .trim()
        const cornerLine = data.address.corner
            ? t('text.labels.cornerFormat', {
                  defaultValue: `esquina ${data.address.corner}`,
                  corner: data.address.corner,
              })
            : ''
        const locality = [data.address.city, data.address.country]
            .map((value) => (value ? String(value).trim() : ''))
            .filter((value) => value.length)
            .join(', ')
        return [streetLine, cornerLine, locality].filter((value) => value && value.trim().length)
    }, [data.address, t])

    const locationSegments = useMemo(() => {
        if (addressLines.length) {
            return addressLines
        }
        if (location && location.trim().length) {
            return [location.trim()]
        }
        return []
    }, [addressLines, location])

    const locationTileValue = useMemo(() => {
        if (!locationSegments.length) {
            return '-'
        }
        if (locationSegments.length === 1) {
            return locationSegments[0]
        }
        return (
            <div className="flex flex-col gap-1">
                {locationSegments.map((value) => (
                    <span key={value}>{value}</span>
                ))}
            </div>
        )
    }, [locationSegments])

    const durationLabel = useMemo(() => {
        if (!start) {
            return '-'
        }
        if (data.allDay) {
            if (end && !start.isSame(end, 'day')) {
                const days = end.endOf('day').diff(start.startOf('day'), 'day') + 1
                return `${days}d`
            }
            return t('calendar.fields.allDay', {
                defaultValue: 'Evento de todo el día',
            })
        }
        if (!end) {
            return t('calendar.messages.noEndTime', {
                defaultValue: 'Sin hora de fin',
            })
        }
        const totalMinutes = Math.max(end.diff(start, 'minute'), 0)
        if (totalMinutes === 0) {
            return '0m'
        }
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        const parts: string[] = []
        if (hours) {
            parts.push(`${hours}h`)
        }
        if (minutes) {
            parts.push(`${minutes}m`)
        }
        return parts.join(' ')
    }, [data.allDay, end, start, t])

    const eventTitle =
        data.name?.trim() ||
        t('text.labels.title', {
            defaultValue: 'Título',
        })

    return (
        <Card>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <span
                                className="mt-1 h-3 w-3 rounded-full"
                                style={{ backgroundColor: eventAccent.color }}
                                aria-hidden="true"
                            />
                            <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {eventTitle}
                            </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {eventTypeLabel && (
                                <Tag
                                    className="border"
                                    style={{
                                        color: eventAccent.color,
                                        backgroundColor: eventAccent.background,
                                        borderColor: eventAccent.border,
                                    }}
                                >
                                    {eventTypeLabel}
                                </Tag>
                            )}
                            {data.allDay && (
                                <Tag className="border border-transparent bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200">
                                    {t('calendar.fields.allDay', {
                                        defaultValue: 'Evento de todo el día',
                                    })}
                                </Tag>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            icon={<HiPencilAlt />}
                            variant="solid"
                            onClick={onEdit}
                        >
                            {t('text.actions.edit')}
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <MetaTile
                        icon={<HiOutlineCalendar className="h-5 w-5" />}
                        label={t('text.labels.date', { defaultValue: 'Fecha' })}
                        value={dateLabel}
                    />
                    <MetaTile
                        icon={<HiOutlineClock className="h-5 w-5" />}
                        label={t('text.labels.time', { defaultValue: 'Horario' })}
                        value={timeLabel}
                    />
                    <MetaTile
                        icon={<HiOutlineSwitchHorizontal className="h-5 w-5" />}
                        label={t('calendar.labels.duration', {
                            defaultValue: 'Duración',
                        })}
                        value={durationLabel}
                    />
                    <MetaTile
                        icon={<HiOutlineLocationMarker className="h-5 w-5" />}
                        label={t('calendar.labels.address', {
                            defaultValue: 'Dirección',
                        })}
                        value={locationTileValue}
                    />
                </div>
            </div>
        </Card>
    )
}

export default ActivityProfile
