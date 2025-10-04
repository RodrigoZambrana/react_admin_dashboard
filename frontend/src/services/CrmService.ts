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
}

type CalendarEventMetadata = {
    address?: CalendarEventAddress
    customType?: string
    locationLabel?: string
    color?: string
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
    extendedProps?: {
        type?: string
        eventType?: string
        location?: string
        address?: CalendarEventAddress
        detail?: string
        projectId?: number | null
        taskId?: number | null
        isInternal?: boolean
        attachments?: {
            id: string
            name: string
            type?: string
            size?: number
            url?: string
        }[]
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
    const entries = Object.entries(metadata).filter(([key, value]) => {
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
    const type = metadata.customType || uiTypeFromBackend(event.type)
    const locationLabel =
        metadata.locationLabel ||
        event.location ||
        buildAddressLabel(address) ||
        ''
    const color =
        metadata.color ||
        event.color ||
        EVENT_TYPE_COLOR_MAP[event.type ?? 'OTHER'] ||
        'indigo'
    return {
        id: String(event.id),
        title: event.title,
        start: event.startAt,
        end: event.endAt || undefined,
        allDay: Boolean(event.allDay),
        eventColor: color,
        extendedProps: {
            type,
            eventType: type,
            location: locationLabel,
            address,
            detail: event.description || '',
            projectId: event.projectId ?? undefined,
            taskId: event.taskId ?? undefined,
            isInternal: type === 'internal',
            attachments: [],
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
    const metadata: CalendarEventMetadata = {
        address: address && hasAddressValue(address) ? address : undefined,
        customType: typeKey,
        locationLabel: event.extendedProps?.location,
        color: event.eventColor,
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
    }
}

export const mapBackendEventToDto = mapApiEventToDto

export async function apiGetCrmDashboardData<T>() {
    return ApiService.fetchData<T>({
        url: '/crm/dashboard',
        method: 'get',
    })
}

export async function apiGetCrmCalendar() {
    const response = await ApiService.fetchData<{ events: ApiCalendarEvent[] }>(
        {
            url: '/calendar/events',
            method: 'get',
        },
    )
    const events = response.data.events || []
    return events.map(mapApiEventToDto)
}

export async function apiCreateCrmCalendarEvent(data: CalendarEventDto) {
    const response = await ApiService.fetchData<ApiCalendarEvent>({
        url: '/calendar/events',
        method: 'post',
        data: mapDtoToApiEvent(data),
    })
    return mapApiEventToDto(response.data)
}

export async function apiUpdateCrmCalendarEvent(
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

export async function apiGetCrmCustomers<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customers',
        method: 'post',
        data,
    })
}

export async function apiGetCrmCustomersStatistic<T>() {
    return ApiService.fetchData<T>({
        url: '/crm/customers-statistic',
        method: 'get',
    })
}

export async function apPutCrmCustomer<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customers',
        method: 'put',
        data,
    })
}

export async function apiGetCrmCustomerDetails<
    T,
    U extends Record<string, unknown>,
>(params: U) {
    return ApiService.fetchData<T>({
        url: '/crm/customer-details',
        method: 'get',
        params,
    })
}

export async function apiDeleteCrmCustomer<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/crm/customer/delete',
        method: 'delete',
        data,
    })
}

// Addresses
export async function apiGetCustomerAddresses<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customer-addresses',
        method: 'get',
        params,
    })
}

export async function apiCreateCustomerAddress<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customer-addresses',
        method: 'post',
        data,
    })
}

export async function apiUpdateCustomerAddress<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customer-addresses/' + (data as any).id,
        method: 'put',
        data,
    })
}

export async function apiSetPrimaryCustomerAddress<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customer-addresses/' + (params as any).id + '/set-primary',
        method: 'put',
    })
}

export async function apiDeleteCustomerAddress<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/customer-addresses/' + (params as any).id,
        method: 'delete',
    })
}

export async function apiGetCrmMails<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/mails',
        method: 'get',
        params,
    })
}

export async function apiGetCrmMail<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/crm/mail',
        method: 'get',
        params,
    })
}
