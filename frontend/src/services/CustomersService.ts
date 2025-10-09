import ApiService from './ApiService'

type ApiCalendarEvent = {
    id: number
    title: string
    description?: string
    type?: string
    startAt: string
    endAt?: string | null
    allDay?: boolean
    location?: string
    projectId?: number | null
    taskId?: number | null
    color?: string | null
    metadata?: unknown
    eventTypeId?: number | null
    eventType?: {
        id: number
        name: string
        color?: string | null
    } | null
    attachments?: {
        id: number
        name: string
        mimeType?: string | null
        size?: number | null
        content?: string | null
    }[]
}

const EVENT_TYPE_COLOR_MAP: Record<string, string> = {
    MEETING: 'blue',
    TASK: 'emerald',
    WORKSHOP: 'purple',
    OTHER: 'indigo',
}

export type CalendarEventAddress = {
    street?: string
    number?: string
    corner?: string | null
    apartment?: string | null
    city?: string
    country?: string
    countryCode?: string | null
}

export type CalendarEventAttachment = {
    id: string
    name: string
    type?: string
    size?: number
    url?: string
    content?: string
}

type CalendarEventMetadata = {
    address?: CalendarEventAddress
    customType?: string
    locationLabel?: string
    color?: string
    eventTypeId?: string | number
    eventTypeName?: string
    customerId?: string | number
}

const uiTypeFromBackend = (type?: string) => {
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

const backendTypeFromUi = (type?: string) => {
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

export type CalendarEventDto = {
    id: string
    title: string
    start: string
    end?: string
    allDay?: boolean
    eventColor: string
    groupId?: string
    eventTypeId?: string | number | null
    extendedProps?: {
        type?: string
        eventType?: string
        eventTypeId?: string
        eventTypeName?: string
        location?: string
        address?: CalendarEventAddress
        detail?: string
        projectId?: number | null
        taskId?: number | null
        isInternal?: boolean
        attachments?: CalendarEventAttachment[]
        customerId?: string
    }
}

const parseJson = (value: string) => {
    try {
        return JSON.parse(value)
    } catch (error) {
        return null
    }
}

const normalizeMetadata = (metadata: unknown): CalendarEventMetadata => {
    if (!metadata) {
        return {}
    }
    if (typeof metadata === 'string') {
        const parsed = parseJson(metadata)
        return normalizeMetadata(parsed)
    }
    if (typeof metadata === 'object') {
        return metadata as CalendarEventMetadata
    }
    return {}
}

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
    ].some((value) => value !== undefined && value !== null && String(value).trim() !== '')
}

const buildAddressLabel = (address?: CalendarEventAddress) => {
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

const sanitizeMetadata = (metadata: CalendarEventMetadata) => {
    const entries = Object.entries(metadata).filter(([_, value]) => {
        if (value === undefined || value === null) {
            return false
        }
        if (typeof value === 'string') {
            return value.trim() !== ''
        }
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                return value.length > 0
            }
            return Object.keys(value as Record<string, unknown>).length > 0
        }
        return true
    })
    if (entries.length === 0) {
        return undefined
    }
    return Object.fromEntries(entries)
}

const mapApiEventToDto = (event: ApiCalendarEvent): CalendarEventDto => {
    const metadata = normalizeMetadata(event.metadata)
    const address = metadata.address || {}
    const metadataEventTypeId =
        (metadata as Record<string, unknown>).eventTypeId ??
        (metadata as Record<string, unknown>).eventTypeID ??
        undefined
    const rawEventTypeId =
        event.eventTypeId ??
        (metadataEventTypeId !== undefined ? metadataEventTypeId : undefined)
    const eventTypeId =
        rawEventTypeId !== undefined && rawEventTypeId !== null
            ? String(rawEventTypeId)
            : undefined
    const eventTypeName =
        (metadata as Record<string, unknown>).eventTypeName ||
        event.eventType?.name ||
        metadata.customType ||
        metadata.type ||
        undefined
    const type = metadata.customType || eventTypeName || uiTypeFromBackend(event.type)
    const locationLabel =
        metadata.locationLabel ||
        event.location ||
        buildAddressLabel(address) ||
        ''
    const rawCustomerId =
        metadata.customerId ??
        (metadata as Record<string, unknown>).customerID ??
        (metadata as Record<string, unknown>).customer ??
        undefined
    const customerId =
        rawCustomerId !== undefined &&
        rawCustomerId !== null &&
        String(rawCustomerId).trim() !== ''
            ? String(rawCustomerId)
            : undefined
    const color =
        metadata.color ||
        event.color ||
        event.eventType?.color ||
        EVENT_TYPE_COLOR_MAP[event.type ?? 'OTHER'] ||
        'indigo'
    const attachments = (event.attachments || []).map((attachment) => ({
        id: String(attachment.id),
        name: attachment.name,
        type: attachment.mimeType ?? undefined,
        size: attachment.size ?? undefined,
        url: `/calendar/attachments/${attachment.id}`,
        content: attachment.content ?? undefined,
    }))
    return {
        id: String(event.id),
        title: event.title,
        start: event.startAt,
        end: event.endAt || undefined,
        allDay: Boolean(event.allDay),
        eventColor: color,
        eventTypeId: eventTypeId ?? null,
        extendedProps: {
            type,
            eventType: eventTypeName || type,
            eventTypeId,
            eventTypeName: eventTypeName || type,
            location: locationLabel,
            address,
            detail: event.description || '',
            projectId: event.projectId ?? undefined,
            taskId: event.taskId ?? undefined,
            isInternal: type === 'internal',
            attachments,
            customerId,
        },
    }
}

const mapDtoToApiEvent = (event: CalendarEventDto) => {
    const detail = event.extendedProps?.detail ?? ''
    const typeKey = event.extendedProps?.type || event.extendedProps?.eventType
    const type = backendTypeFromUi(typeKey)
    const toNumberOrNull = (value: unknown) => {
        if (value === undefined || value === null || value === '') {
            return null
        }
        const num = Number(value)
        return Number.isNaN(num) ? null : num
    }
    const address = event.extendedProps?.address
    const rawEventTypeId =
        event.eventTypeId ?? event.extendedProps?.eventTypeId ?? null
    const attachmentsPayload = (event.extendedProps?.attachments || []).map(
        (attachment) => {
            const payload: Record<string, unknown> = {
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
            }
            if (attachment.id !== undefined) {
                const numericId = Number(attachment.id)
                if (Number.isFinite(numericId) && numericId > 0) {
                    payload.id = numericId
                } else {
                    payload.id = attachment.id
                }
            }
            if (attachment.content) {
                payload.content = attachment.content
            }
            return payload
        },
    )
    const metadata: CalendarEventMetadata = {
        address: address && hasAddressValue(address) ? address : undefined,
        customType: typeKey,
        locationLabel: event.extendedProps?.location,
        color: event.eventColor,
        eventTypeId: rawEventTypeId ?? undefined,
        eventTypeName:
            event.extendedProps?.eventType ??
            event.extendedProps?.type ??
            undefined,
        customerId:
            (() => {
                const candidate = event.extendedProps?.customerId
                if (candidate === undefined || candidate === null) {
                    return undefined
                }
                const normalized = String(candidate).trim()
                if (!normalized) {
                    return undefined
                }
                const asNumber = Number(normalized)
                return Number.isFinite(asNumber) ? asNumber : normalized
            })(),
    }
    const locationLabel =
        event.extendedProps?.location || buildAddressLabel(address) || undefined
    return {
        title: event.title,
        description: detail,
        type,
        startAt: event.start,
        endAt: event.end ?? null,
        allDay: Boolean(event.allDay),
        location: locationLabel,
        color: event.eventColor,
        metadata: sanitizeMetadata(metadata),
        projectId: toNumberOrNull(event.extendedProps?.projectId),
        taskId: toNumberOrNull(event.extendedProps?.taskId),
        eventTypeId: toNumberOrNull(rawEventTypeId),
        attachments: attachmentsPayload,
    }
}

export const mapBackendEventToDto = mapApiEventToDto

export async function apiGetCustomersDashboardData<T>() {
    return ApiService.fetchData<T>({
        url: '/customers/dashboard',
        method: 'get',
    })
}

export async function apiGetCustomerCalendar() {
    const response = await ApiService.fetchData<{ events: ApiCalendarEvent[] }>(
        {
            url: '/calendar/events',
            method: 'get',
        },
    )
    const events = response.data.events || []
    return events.map(mapApiEventToDto)
}

export async function apiCreateCustomerCalendarEvent(data: CalendarEventDto) {
    const response = await ApiService.fetchData<ApiCalendarEvent>({
        url: '/calendar/events',
        method: 'post',
        data: mapDtoToApiEvent(data),
    })
    return mapApiEventToDto(response.data)
}

export async function apiUpdateCustomerCalendarEvent(
    id: string,
    data: CalendarEventDto,
) {
    const response = await ApiService.fetchData<ApiCalendarEvent>({
        url: `/calendar/events/${id}`,
        method: 'put',
        data: mapDtoToApiEvent(data),
    })
    return mapApiEventToDto(response.data)
}

export async function apiDeleteCustomerCalendarEvent(id: string) {
    await ApiService.fetchData({
        url: `/calendar/events/${id}`,
        method: 'delete',
    })
    return id
}

export async function apiGetCustomers<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/customers/query',
        method: 'post',
        data,
    })
}

export async function apiGetCustomerStatistics<T>() {
    return ApiService.fetchData<T>({
        url: '/customers/statistics',
        method: 'get',
    })
}

export async function apiGetCustomersStatistic<T>() {
    return apiGetCustomerStatistics<T>()
}

export async function apiUpsertCustomer<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/customers',
        method: 'put',
        data,
    })
}

export async function apiGetCustomerDetails<
    T,
    U extends Record<string, unknown>,
>(params: U) {
    return ApiService.fetchData<T>({
        url: `/customers/${(params as any).id}`,
        method: 'get',
    })
}

export async function apiDeleteCustomer<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: `/customers/${(data as any).id}`,
        method: 'delete',
    })
}

// Addresses
export async function apiGetCustomerAddresses<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: `/customers/${(params as any).customerId}/addresses`,
        method: 'get',
    })
}

export async function apiCreateCustomerAddress<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: `/customers/${(data as any).customerId}/addresses`,
        method: 'post',
        data,
    })
}

export async function apiUpdateCustomerAddress<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: `/customers/${(data as any).customerId}/addresses/${(data as any).id}`,
        method: 'put',
        data,
    })
}

export async function apiSetPrimaryCustomerAddress<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: `/customers/${(params as any).customerId}/addresses/${(params as any).id}/set-primary`,
        method: 'put',
    })
}

export async function apiDeleteCustomerAddress<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: `/customers/${(params as any).customerId}/addresses/${(params as any).id}`,
        method: 'delete',
    })
}

export async function apiGetCustomerMails<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/customers/mails',
        method: 'get',
        params,
    })
}

export async function apiGetCustomerMail<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/customers/mail',
        method: 'get',
        params,
    })
}
