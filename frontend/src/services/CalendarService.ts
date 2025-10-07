import ApiService from './ApiService'
import {
    mapBackendEventToDto,
    type CalendarEventAddress,
    type CalendarEventDto,
    type CalendarEventAttachment,
} from './CrmService'
import dayjs from 'dayjs'

export type CalendarActivityComment = {
    id: string
    message: string
    createdAt: string
    author?: {
        id: string
        name?: string | null
        email?: string
        img?: string | null
    } | null
}

type CalendarActivityDetail = {
    id: string
    name: string
    email: string
    img: string
    role: string
    lastOnline: number
    status: string
    customerId?: string | null
    startAt?: string
    endAt?: string
    allDay?: boolean
    eventType?: string
    eventColor?: string
    date?: string
    time?: string
    personalInfo: {
        location?: string
        phoneNumber?: string
        phoneNumbers?: string[]
        facebook?: string
        twitter?: string
        pinterest?: string
        linkedIn?: string
    }
    address?: CalendarEventAddress
    detail?: string
    attachments?: CalendarEventAttachment[]
    comments?: CalendarActivityComment[]
    sourceEvent?: CalendarEventDto
}

const mapActivityDetail = (event: any): CalendarActivityDetail => {
    if (!event) {
        return {
            id: '',
            name: '',
            email: '',
            img: '/img/avatars/thumb-1.jpg',
            role: 'activity',
            lastOnline: Math.floor(Date.now() / 1000),
            status: 'active',
            startAt: undefined,
            endAt: undefined,
            allDay: undefined,
            eventType: undefined,
            eventColor: undefined,
            personalInfo: {},
            address: undefined,
            detail: '',
            attachments: [],
            comments: [],
            sourceEvent: undefined,
        }
    }

    const dto = mapBackendEventToDto(event)
    const startIso = dto.start || (event.startAt ? dayjs(event.startAt).toISOString() : undefined)
    const endIso = dto.end || (event.endAt ? dayjs(event.endAt).toISOString() : undefined)
    const startAt = startIso ? dayjs(startIso) : dayjs()
    const endAt = endIso ? dayjs(endIso) : undefined
    const allDay = dto.allDay ?? Boolean(event.allDay)
    const time = allDay
        ? 'All day'
        : `${startAt.format('HH:mm')}${endAt ? ` - ${endAt.format('HH:mm')}` : ''}`
    const eventTypeLabel =
        dto.extendedProps?.eventTypeName ||
        dto.extendedProps?.eventType ||
        dto.extendedProps?.type ||
        event.eventType?.name ||
        event.type ||
        'OTHER'
    const locationLabel =
        dto.extendedProps?.location || event.location || ''
    const address = dto.extendedProps?.address as CalendarEventAddress | undefined
    const detail = dto.extendedProps?.detail || event.description || ''
    const attachments = dto.extendedProps?.attachments || []
    const comments = Array.isArray(event.comments)
        ? event.comments.map((comment: any) => ({
              id: String(comment.id),
              message: comment.message,
              createdAt: dayjs(comment.createdAt).toISOString(),
              author: comment.author
                  ? {
                        id: String(comment.author.id),
                        name: comment.author.name,
                        email: comment.author.email,
                        img: comment.author.img,
                    }
                  : null,
          }))
        : []

    const resolvedCustomerId = (() => {
        const metadata = event?.metadata
        const metadataCustomerId = (() => {
            if (!metadata) {
                return undefined
            }
            if (typeof metadata === 'string') {
                try {
                    const parsed = JSON.parse(metadata)
                    if (parsed && typeof parsed === 'object') {
                        return (
                            parsed.customerId ||
                            parsed.customerID ||
                            parsed.customer ||
                            undefined
                        )
                    }
                } catch (_error) {
                    return undefined
                }
                return undefined
            }
            if (typeof metadata === 'object') {
                const metaRecord = metadata as Record<string, unknown>
                return (
                    metaRecord.customerId ||
                    metaRecord.customerID ||
                    metaRecord.customer ||
                    undefined
                )
            }
            return undefined
        })()
        const fallbackCustomerId =
            event.projectId ??
            event.task?.customerId ??
            event.customerId ??
            dto.extendedProps?.projectId ??
            undefined
        const raw =
            dto.extendedProps?.customerId ??
            metadataCustomerId ??
            fallbackCustomerId
        if (raw === undefined || raw === null) {
            return undefined
        }
        const normalized = String(raw).trim()
        return normalized.length ? normalized : undefined
    })()

    return {
        id: String(event.id),
        name: dto.title || event.title,
        email:
            event.createdBy?.email || event.project?.email || 'activities@themenate.com',
        img: event.createdBy?.img || '/img/avatars/thumb-1.jpg',
        role: String(event.type || eventTypeLabel || 'OTHER').toLowerCase(),
        eventType: eventTypeLabel,
        eventColor: dto.eventColor,
        lastOnline: Math.floor(Date.now() / 1000),
        status: 'active',
        customerId: resolvedCustomerId ?? null,
        startAt: startIso,
        endAt: endIso,
        allDay: Boolean(allDay),
        date: startAt.format('YYYY-MM-DD'),
        time,
        personalInfo: {
            location: locationLabel,
            phoneNumber: '',
            phoneNumbers: [],
            facebook: '',
            twitter: '',
            pinterest: '',
            linkedIn: '',
        },
        address,
        detail,
        attachments,
        comments,
        sourceEvent: dto,
    }
}

export async function apiGetCalendarActivityDetails<U extends Record<string, unknown>>(
    params: U,
) {
    const response = await ApiService.fetchData<any>({
        url: '/calendar/activity',
        method: 'get',
        params,
    })
    return mapActivityDetail(response.data)
}

export async function apiDeleteCalendarAttachment(id: string) {
    await ApiService.fetchData({
        url: `/calendar/attachments/${id}`,
        method: 'delete',
    })
    return id
}

export async function apiFetchCalendarAttachment(
    id: string,
    options: { mode?: 'inline' | 'attachment' } = {},
) {
    const response = await ApiService.fetchData<Blob>({
        url: `/calendar/attachments/${id}`,
        method: 'get',
        params: options.mode ? { mode: options.mode } : undefined,
        responseType: 'blob',
    })
    return response
}

export async function apiCreateCalendarActivityComment(
    id: string,
    data: { message: string },
) {
    const response = await ApiService.fetchData<CalendarActivityComment>({
        url: `/calendar/events/${id}/comments`,
        method: 'post',
        data,
    })
    return response.data
}

export async function apiUpdateCalendarActivityComment(
    id: string,
    data: { message: string },
) {
    const response = await ApiService.fetchData<CalendarActivityComment>({
        url: `/calendar/comments/${id}`,
        method: 'put',
        data,
    })
    return response.data
}

export async function apiDeleteCalendarActivityComment(id: string) {
    await ApiService.fetchData({
        url: `/calendar/comments/${id}`,
        method: 'delete',
    })
    return id
}

export async function apiSearchCalendarActivities(
    params?: { q?: string },
): Promise<CalendarEventDto[]> {
    const response = await ApiService.fetchData<{ events: any[] }>(
        {
            url: '/calendar/events',
            method: 'get',
        },
    )
    const events = (response.data.events || []).map(mapBackendEventToDto)
    if (!params?.q) {
        return events
    }
    const term = params.q.toLowerCase()
    return events.filter((event: CalendarEventDto) => {
        const extended = event.extendedProps || {}
        return [
            event.title,
            event.start,
            event.end,
            extended.detail,
            extended.location,
            extended.type,
        ]
            .filter((value) => value !== undefined && value !== null)
            .some((value) => String(value).toLowerCase().includes(term))
    })
}
