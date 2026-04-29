export const CONVERSION_EVENT_NAMES = [
  'whatsapp_click',
  'phone_click',
  'form_submit',
  'purchase_completed',
  'lead_created',
] as const

export type AnalyticsConversionEventName = (typeof CONVERSION_EVENT_NAMES)[number]

export type AnalyticsEventCategory = 'conversion' | 'engagement'
export type AnalyticsEventSource = 'web' | 'ads' | 'ga4'
export type AnalyticsMeasurementStatus = 'not_ready' | 'partial' | 'ready'

export const isConversionEventName = (value: string | null | undefined) =>
  typeof value === 'string' && CONVERSION_EVENT_NAMES.includes(value as AnalyticsConversionEventName)

export const normalizeAnalyticsEventCategory = (
  value: unknown,
  eventName?: string | null,
): AnalyticsEventCategory => {
  if (value === 'conversion' || value === 'engagement') {
    return value
  }
  return isConversionEventName(eventName) ? 'conversion' : 'engagement'
}

export const normalizeAnalyticsEventSource = (value: unknown): AnalyticsEventSource => {
  if (value === 'web' || value === 'ads' || value === 'ga4') {
    return value
  }
  return 'web'
}

export const normalizeAnalyticsMeasurementStatus = (
  value: unknown,
  category: AnalyticsEventCategory,
): AnalyticsMeasurementStatus => {
  if (value === 'not_ready' || value === 'partial' || value === 'ready') {
    return value
  }
  return category === 'conversion' ? 'partial' : 'ready'
}
