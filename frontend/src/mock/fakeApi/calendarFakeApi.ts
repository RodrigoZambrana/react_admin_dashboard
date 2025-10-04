/* eslint-disable  @typescript-eslint/no-explicit-any */
import type { Server } from 'miragejs'

const matchSearch = (value: unknown, term: string) => {
    if (value === null || value === undefined) {
        return false
    }
    return String(value).toLowerCase().includes(term)
}

const EVENT_TYPE_COLOR_MAP: Record<string, string> = {
    MEETING: 'blue',
    TASK: 'emerald',
    WORKSHOP: 'purple',
    OTHER: 'indigo',
}

const backendTypeToUi = (type?: string) => {
    switch ((type || '').toUpperCase()) {
        case 'MEETING':
            return 'meeting'
        case 'TASK':
            return 'task'
        case 'WORKSHOP':
            return 'workshop'
        default:
            return 'other'
    }
}

const uiTypeToBackend = (type?: string) => {
    switch ((type || '').toLowerCase()) {
        case 'meeting':
            return 'MEETING'
        case 'task':
            return 'TASK'
        case 'workshop':
            return 'WORKSHOP'
        default:
            return 'OTHER'
    }
}

const uiEventToBackend = (event: any) => {
    const extended = event.extendedProps || {}
    const backendType = uiTypeToBackend(extended.type)
    return {
        id: Number(event.id),
        title: event.title,
        description: extended.detail || '',
        type: backendType,
        startAt: event.start,
        endAt: event.end || null,
        allDay: Boolean(event.allDay),
        location: extended.location || '',
        projectId: extended.projectId ?? null,
        taskId: extended.taskId ?? null,
    }
}

const backendEventToUi = (event: any) => {
    const uiType = backendTypeToUi(event.type)
    return {
        id: String(event.id),
        title: event.title,
        start: event.startAt,
        end: event.endAt || undefined,
        allDay: Boolean(event.allDay),
        eventColor: EVENT_TYPE_COLOR_MAP[event.type ?? 'OTHER'] || 'indigo',
        extendedProps: {
            type: uiType,
            detail: event.description || '',
            location: event.location || '',
            projectId: event.projectId ?? undefined,
            taskId: event.taskId ?? undefined,
        },
    }
}

const generateId = () => Date.now().toString()

export default function calendarFakeApi(server: Server, apiPrefix: string) {
    server.get(`${apiPrefix}/calendar/events`, (schema) => {
        const events = ((schema.db as any).eventsData || []).map((event: any) =>
            uiEventToBackend(event),
        )
        return { events }
    })

    server.post(`${apiPrefix}/calendar/events`, (schema, { requestBody }) => {
        const payload = JSON.parse(requestBody || '{}')
        const id = payload.id || generateId()
        const uiEvent = backendEventToUi({ ...payload, id })
        ;(schema.db as any).eventsData.insert(uiEvent)
        return uiEventToBackend(uiEvent)
    })

    server.put(`${apiPrefix}/calendar/events/:id`, (schema, { params, requestBody }) => {
        const payload = JSON.parse(requestBody || '{}')
        const id = String(params.id)
        const uiEvent = backendEventToUi({ ...payload, id })
        ;(schema.db as any).eventsData.update(id, uiEvent)
        return uiEventToBackend(uiEvent)
    })

    server.get(`${apiPrefix}/calendar/activities`, (schema, { queryParams }) => {
        const { q } = queryParams
        const events = (schema.db as any).eventsData || []
        if (!q) {
            return events
        }
        const term = String(q).toLowerCase()
        return events.filter((event: any) => {
            const extended = event.extendedProps || {}
            return (
                matchSearch(event.title, term) ||
                matchSearch(event.start, term) ||
                matchSearch(event.end, term) ||
                matchSearch(event.eventColor, term) ||
                matchSearch(extended.detail, term) ||
                matchSearch(extended.location, term) ||
                matchSearch(extended.type, term) ||
                matchSearch(extended.customerId, term) ||
                matchSearch(event.id, term)
            )
        })
    })

    server.get(`${apiPrefix}/calendar/activity`, (schema, { queryParams }) => {
        const { id } = queryParams
        const list = (schema.db as any).activityDetailData || []
        const idStr = String(id ?? '')
        const found = list.find((item: any) => String(item.id) === idStr)
        if (found) {
            return found
        }

        const events = (schema.db as any).eventsData || []
        const event = events.find((item: any) => String(item.id) === idStr)
        if (!event) {
            return list[0] || {}
        }

        const extended = event.extendedProps || {}
        return {
            id: event.id,
            name: event.title,
            email: extended?.contactEmail || 'activities@themenate.com',
            img: '/img/avatars/thumb-1.jpg',
            role: extended?.type || 'Actividad',
            lastOnline: Date.now() / 1000,
            status: 'active',
            customerId: extended?.customerId,
            date: event.start?.slice(0, 10),
            time: event.start,
            personalInfo: {
                location: extended?.location || 'Por definir',
                title: event.title,
                birthday: '26/09/2025',
                phoneNumber: '+1 (000) 000-0000',
                facebook: '',
                twitter: '',
                pinterest: '',
                linkedIn: '',
            },
            attachments: extended?.attachments || [],
            detail: extended?.detail,
            isInternal: Boolean(extended?.isInternal),
        }
    })
}
