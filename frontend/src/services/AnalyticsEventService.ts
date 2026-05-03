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
    event_id?: string | null
    gclid?: string | null
    wbraid?: string | null
    gbraid?: string | null
    transaction_id?: string | null
    currency?: string | null
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
const ATTRIBUTION_STORAGE_KEY = 'analytics_attribution_context'
const ATTRIBUTION_COOKIE_KEY = 'analytics_attribution_context'
const CONVERSION_EVENTS = new Set<AnalyticsEventName>([
    'whatsapp_click',
    'phone_click',
    'form_submit',
    'purchase_completed',
    'lead_created',
])

type StoredAttributionContext = {
    gclid: string | null
    wbraid: string | null
    gbraid: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    captured_at: string
}

const ATTRIBUTION_KEYS = ['gclid', 'wbraid', 'gbraid', 'utm_source', 'utm_medium', 'utm_campaign'] as const

const sanitizeString = (value: string | null | undefined) => {
    if (typeof value !== 'string') {
        return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

const safeStorage = () => {
    if (typeof window === 'undefined') {
        return null
    }
    try {
        return window.localStorage
    } catch {
        return null
    }
}

const writeCookie = (name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 90) => {
    if (typeof document === 'undefined') {
        return
    }
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
}

const readCookie = (name: string) => {
    if (typeof document === 'undefined') {
        return null
    }
    const encodedName = `${encodeURIComponent(name)}=`
    const parts = document.cookie.split(';')
    for (const part of parts) {
        const trimmed = part.trim()
        if (trimmed.startsWith(encodedName)) {
            return decodeURIComponent(trimmed.slice(encodedName.length))
        }
    }
    return null
}

const storeAttributionContext = (context: StoredAttributionContext) => {
    const storage = safeStorage()
    const serialized = JSON.stringify(context)
    if (storage) {
        try {
            storage.setItem(ATTRIBUTION_STORAGE_KEY, serialized)
        } catch {
            // ignore storage quota or privacy errors
        }
    }
    writeCookie(ATTRIBUTION_COOKIE_KEY, serialized)
}

export const captureAnalyticsAttributionFromLocation = () => {
    if (typeof window === 'undefined') {
        return null
    }

    const params = new URLSearchParams(window.location.search)
    const nextContext: StoredAttributionContext = {
        gclid: sanitizeString(params.get('gclid')),
        wbraid: sanitizeString(params.get('wbraid')),
        gbraid: sanitizeString(params.get('gbraid')),
        utm_source: sanitizeString(params.get('utm_source')),
        utm_medium: sanitizeString(params.get('utm_medium')),
        utm_campaign: sanitizeString(params.get('utm_campaign')),
        captured_at: new Date().toISOString(),
    }

    if (
        !nextContext.gclid &&
        !nextContext.wbraid &&
        !nextContext.gbraid &&
        !nextContext.utm_source &&
        !nextContext.utm_medium &&
        !nextContext.utm_campaign
    ) {
        return null
    }

    storeAttributionContext(nextContext)
    return nextContext
}

const readAttributionContext = (): Partial<StoredAttributionContext> => {
    if (typeof window === 'undefined') {
        return {}
    }

    const storage = safeStorage()
    const raw =
        storage?.getItem(ATTRIBUTION_STORAGE_KEY) ??
        readCookie(ATTRIBUTION_COOKIE_KEY) ??
        null
    if (!raw) {
        return {}
    }

    try {
        return JSON.parse(raw) as StoredAttributionContext
    } catch {
        return {}
    }
}

const ensureEventId = (input: TrackAnalyticsEventInput) => {
    const existing = sanitizeString(input.event_id)
    if (existing) {
        return existing
    }
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
}

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
    const attributionContext = readAttributionContext()
    const category =
        input.category ??
        (CONVERSION_EVENTS.has(input.event as AnalyticsEventName) ||
        input.event.includes('_click') ||
            input.event.includes('submit')
            ? 'conversion'
            : 'engagement')

    return {
        event: input.event,
        event_id: ensureEventId(input),
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
        gclid: input.gclid ?? attributionContext.gclid ?? null,
        wbraid: input.wbraid ?? attributionContext.wbraid ?? null,
        gbraid: input.gbraid ?? attributionContext.gbraid ?? null,
        transaction_id: input.transaction_id ?? null,
        currency: input.currency ?? null,
        device: input.device ?? getDevice(),
        country: input.country ?? null,
        value: input.value ?? null,
        user_id: input.user_id ?? null,
        metadata: input.metadata ?? {},
        data: input.data ?? {},
        correlation_id: input.correlation_id ?? null,
    }
}

type CanonicalConversionTrackPayload = {
    event: string
    event_id: string
    category: 'conversion'
    source: 'web'
    measurement_status: 'partial' | 'ready'
    timestamp: string
    session_id: string
    url: string
    user_agent: string
    page: string | null
    path: string | null
    referrer: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    gclid: string | null
    wbraid: string | null
    gbraid: string | null
    transaction_id: string | null
    currency: string | null
    device: string | null
    country: string | null
    value: number | null
    user_id: string | null
    metadata: Record<string, unknown>
    data: Record<string, unknown>
    correlation_id: string | null
}

const buildConversionTrackPayload = (
    input: TrackAnalyticsEventInput,
    basePayload?: ReturnType<typeof buildAnalyticsEventPayload>,
): CanonicalConversionTrackPayload | null => {
    const event = (input.event ?? '').trim()
    if (!CONVERSION_EVENTS.has(event as AnalyticsEventName)) {
        return null
    }

    const payload =
        basePayload ??
        buildAnalyticsEventPayload({
            ...input,
            category: 'conversion',
        })

    return {
        ...payload,
        category: 'conversion',
        measurement_status: payload.measurement_status === 'ready' ? 'ready' : 'partial',
    } as CanonicalConversionTrackPayload
}

const sendBeaconOrFetch = async (url: string, payload: unknown) => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
            const sent = navigator.sendBeacon(url, blob)
            if (sent) {
                return { ok: true, transport: 'beacon' as const }
            }
        } catch {
            // fall through to fetch
        }
    }

    return await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
        keepalive: true,
    })
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput) {
    if (typeof window === 'undefined') {
        return null
    }

    const payload = buildAnalyticsEventPayload(input)
    const conversionPayload = buildConversionTrackPayload(input, payload)
    try {
        const analyticsTransport = await sendBeaconOrFetch('/api/analytics/events', payload)
        if (
            conversionPayload &&
            (!('ok' in analyticsTransport) || analyticsTransport.ok === true)
        ) {
            void sendBeaconOrFetch('/api/conversions/track', conversionPayload).catch(() => undefined)
        }

        return analyticsTransport
    } catch (error) {
        return error
    }
}
