import {
  NotificationAudience,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
} from '@prisma/client'

export type NotificationListQuery = {
  page?: number
  pageSize?: number
  eventType?: NotificationEventType | null
  channel?: NotificationChannel | null
  unreadOnly?: boolean
  since?: Date | null
}

export type NotificationListItem = {
  id: number
  eventType: NotificationEventType | null
  audience: NotificationAudience | null
  channel: NotificationChannel | null
  deliveryStatus: NotificationDeliveryStatus
  title: string | null
  body: string | null
  metadata: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
  orderId: number | null
  paymentId: number | null
}

export type NotificationListResponse = {
  items: NotificationListItem[]
  meta: {
    page: number
    pageSize: number
    total: number
    unread: number
  }
}

export type CreateNotificationInput = {
  eventType: NotificationEventType
  audience: NotificationAudience
  channel: NotificationChannel
  recipientId?: number | null
  customerId?: number | null
  orderId?: number | null
  paymentId?: number | null
  title: string | null
  body?: string | null
  metadata?: Record<string, unknown> | null
  idempotencyKey?: string
}
