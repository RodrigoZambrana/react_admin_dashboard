import type { AnalyticsEventInput } from '../analytics/analytics.types'
import type { CanonicalConversionName } from './conversion-map'

export type TrackConversionInput = AnalyticsEventInput & {
  transaction_id?: string | null
  currency?: string | null
  user_email?: string | null
  user_phone?: string | null
  order_id?: string | null
  conversion_action?: string | null
}

export type ConversionTrackResult = {
  status: 'sent' | 'skipped' | 'failed'
  reason: string | null
  internalEventName: string
  canonicalConversionName: CanonicalConversionName | null
  receiptId: string | null
  dedupeKey: string | null
  googleAds: {
    configured: boolean
    uploaded: boolean
    customerId: string | null
    conversionActionResource: string | null
  }
}

export type ConversionReceiptListItem = {
  id: string
  internalEventName: string
  canonicalConversionName: CanonicalConversionName
  adsConversionAction: string | null
  adsConversionResource: string | null
  transactionId: string | null
  eventId: string | null
  gclid: string | null
  wbraid: string | null
  gbraid: string | null
  value: number | null
  currency: string | null
  status: string
  reason: string | null
  dedupeKey: string
  errorMessage: string | null
  attemptCount: number
  lastAttemptAt: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

