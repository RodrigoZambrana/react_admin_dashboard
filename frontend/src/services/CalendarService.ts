import ApiService from './ApiService'
import { mapBackendEventToDto, type CalendarEventDto } from './CrmService'
import dayjs from 'dayjs'

type CalendarActivityDetail = {
    id: string
    name: string
    email: string
    img: string
    role: string
    lastOnline: number
    status: string
    customerId?: string | number | null
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
    detail?: string
    attachments?: unknown[]
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
            personalInfo: {},
            detail: '',
        }
    }
    const startAt = event.startAt ? dayjs(event.startAt) : dayjs()
    const endAt = event.endAt ? dayjs(event.endAt) : undefined
    const allDay = Boolean(event.allDay)
    const time = allDay
        ? 'All day'
        : `${startAt.format('HH:mm')}${endAt ? ` - ${endAt.format('HH:mm')}` : ''}`
    return {
        id: String(event.id),
        name: event.title,
        email:
            event.createdBy?.email || event.project?.email || 'activities@themenate.com',
        img: event.createdBy?.img || '/img/avatars/thumb-1.jpg',
        role: (event.type || 'OTHER').toLowerCase(),
        lastOnline: Math.floor(Date.now() / 1000),
        status: 'active',
        customerId: event.projectId || event.task?.customerId || undefined,
        date: startAt.format('YYYY-MM-DD'),
        time,
        personalInfo: {
            location: event.location || '',
            phoneNumber: '',
            phoneNumbers: [],
            facebook: '',
            twitter: '',
            pinterest: '',
            linkedIn: '',
        },
        detail: event.description || '',
        attachments: [],
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
