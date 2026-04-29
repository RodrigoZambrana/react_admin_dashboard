export type AnalyticsEventCategory = 'conversion' | 'engagement'
export type AnalyticsEventSource = 'web' | 'ads' | 'ga4'
export type AnalyticsMeasurementStatus = 'not_ready' | 'partial' | 'ready'

export type AnalyticsEventName =
    | 'whatsapp_click'
    | 'phone_click'
    | 'form_submit'
    | 'purchase_completed'
    | 'lead_created'

export type TrackAnalyticsEventInput = {
    event: AnalyticsEventName | string
    category?: AnalyticsEventCategory
    source?: AnalyticsEventSource
    measurement_status?: AnalyticsMeasurementStatus
    page?: string
    path?: string
    referrer?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    device?: string | null
    country?: string | null
    value?: number | null
    user_id?: string | null
    metadata?: Record<string, unknown>
    data?: Record<string, unknown>
    correlation_id?: string | null
    timestamp?: string
    session_id?: string
    url?: string
    user_agent?: string
}

const SESSION_STORAGE_KEY = 'analytics_session_id'
const CONVERSION_EVENTS = new Set<AnalyticsEventName>([
    'whatsapp_click',
    'phone_click',
    'form_submit',
    'purchase_completed',
    'lead_created',
])

const getSessionId = () => {
    if (typeof window === 'undefined') {
        return typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : Math.random().toString(36).slice(2)
    }

    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing && existing.trim().length > 0) {
        return existing
    }

    const generated =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2)
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated)
    return generated
}

const getDevice = () => {
    if (typeof navigator === 'undefined') {
        return null
    }
    return /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
}

const getCurrentPage = () => {
    if (typeof window === 'undefined') {
        return { page: null, path: null, url: null, referrer: null }
    }

    return {
        page: window.location.pathname,
        path: window.location.pathname,
        url: window.location.href,
        referrer: document.referrer || null,
    }
}

const getUtmFromLocation = () => {
    if (typeof window === 'undefined') {
        return {}
    }

    const params = new URLSearchParams(window.location.search)
    return {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
    }
}

export const buildAnalyticsEventPayload = (input: TrackAnalyticsEventInput) => {
    const pageContext = getCurrentPage()
    const utmContext = getUtmFromLocation()
    const category =
        input.category ??
        (CONVERSION_EVENTS.has(input.event as AnalyticsEventName) ||
        input.event.includes('_click') ||
        input.event.includes('submit')
            ? 'conversion'
            : 'engagement')

    return {
        event: input.event,
        category,
        source: input.source ?? 'web',
        measurement_status:
            input.measurement_status ?? (category === 'conversion' ? 'partial' : 'ready'),
        timestamp: input.timestamp ?? new Date().toISOString(),
        session_id: input.session_id ?? getSessionId(),
        url: input.url ?? pageContext.url ?? '',
        user_agent: input.user_agent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        page: input.page ?? pageContext.page,
        path: input.path ?? pageContext.path,
        referrer: input.referrer ?? pageContext.referrer,
        utm_source: input.utm_source ?? utmContext.utm_source ?? null,
        utm_medium: input.utm_medium ?? utmContext.utm_medium ?? null,
        utm_campaign: input.utm_campaign ?? utmContext.utm_campaign ?? null,
        device: input.device ?? getDevice(),
        country: input.country ?? null,
        value: input.value ?? null,
        user_id: input.user_id ?? null,
        metadata: input.metadata ?? {},
        data: input.data ?? {},
        correlation_id: input.correlation_id ?? null,
    }
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput) {
    if (typeof window === 'undefined') {
        return null
    }

    const payload = buildAnalyticsEventPayload(input)
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
            const sent = navigator.sendBeacon('/api/analytics/events', blob)
            if (sent) {
                return { ok: true }
            }
        }

        return await fetch('/api/analytics/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            credentials: 'include',
            keepalive: true,
        })
    } catch (error) {
        return error
    }
}
