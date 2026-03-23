import { Injectable, Logger } from '@nestjs/common'
import {
  Notification,
  NotificationAudience,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  Prisma,
} from '@prisma/client'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationQueueService } from './notification-queue.service'
import {
  CreateNotificationInput,
  NotificationListItem,
  NotificationListQuery,
  NotificationListResponse,
} from './notifications.types'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: NotificationQueueService,
  ) {}

  async listForUser(userId: number, query: NotificationListQuery): Promise<NotificationListResponse> {
    return this.listNotifications(
      {
        recipientId: userId,
        audience: NotificationAudience.ADMIN,
      },
      query,
    )
  }

  async listForCustomer(customerId: number, query: NotificationListQuery): Promise<NotificationListResponse> {
    return this.listNotifications(
      {
        customerId,
        audience: NotificationAudience.CUSTOMER,
      },
      query,
    )
  }

  async countUnreadForUser(userId: number): Promise<number> {
    return this.prisma.notification.count({
      where: {
        recipientId: userId,
        audience: NotificationAudience.ADMIN,
        readAt: null,
      },
    })
  }

  async countUnreadForCustomer(customerId: number): Promise<number> {
    return this.prisma.notification.count({
      where: {
        customerId,
        audience: NotificationAudience.CUSTOMER,
        readAt: null,
      },
    })
  }

  async markAsReadForUser(userId: number, ids: number[] | null, markAll: boolean): Promise<void> {
    await this.markAsRead(
      {
        recipientId: userId,
        audience: NotificationAudience.ADMIN,
      },
      ids,
      markAll,
    )
  }

  async markAsReadForCustomer(customerId: number, ids: number[] | null, markAll: boolean): Promise<void> {
    await this.markAsRead(
      {
        customerId,
        audience: NotificationAudience.CUSTOMER,
      },
      ids,
      markAll,
    )
  }

  async deleteForUser(userId: number, ids: number[] | null, deleteAll: boolean): Promise<void> {
    await this.deleteNotifications(
      {
        recipientId: userId,
        audience: NotificationAudience.ADMIN,
      },
      ids,
      deleteAll,
    )
  }

  async deleteForCustomer(customerId: number, ids: number[] | null, deleteAll: boolean): Promise<void> {
    await this.deleteNotifications(
      {
        customerId,
        audience: NotificationAudience.CUSTOMER,
      },
      ids,
      deleteAll,
    )
  }

  async createNotifications(inputs: CreateNotificationInput[]): Promise<number[]> {
    if (!inputs.length) {
      return []
    }
    const created: number[] = []
    await this.prisma.$transaction(async (tx) => {
      for (const input of inputs) {
        const key = input.idempotencyKey ?? this.buildIdempotencyKey(input)
        const existing = await tx.notification.findUnique({ where: { idempotencyKey: key } })
        if (existing) {
          continue
        }
        const metadata = this.serializeMetadata(input.metadata)
        const record = await tx.notification.create({
          data: {
            eventType: input.eventType,
            audience: input.audience,
            channel: input.channel,
            deliveryStatus: NotificationDeliveryStatus.PENDING,
            recipientId: input.recipientId ?? null,
            customerId: input.customerId ?? null,
            orderId: input.orderId ?? null,
            paymentId: input.paymentId ?? null,
            title: input.title,
            body: input.body ?? null,
            metadata,
            idempotencyKey: key,
            legacyTarget: input.title ?? null,
            legacyDescription: input.body ?? null,
          },
        })
        created.push(record.id)
      }
    })

    for (const notificationId of created) {
      try {
        await this.queue.enqueue(notificationId)
      } catch (error) {
        this.logger.error(`Failed to enqueue notification ${notificationId}: ${(error as Error).message}`)
      }
    }
    return created
  }

  buildIdempotencyKey(input: CreateNotificationInput): string {
    const payload = {
      eventType: input.eventType,
      audience: input.audience,
      channel: input.channel,
      recipientId: input.recipientId ?? null,
      customerId: input.customerId ?? null,
      orderId: input.orderId ?? null,
      paymentId: input.paymentId ?? null,
      title: input.title ?? null,
      metadata: input.metadata ?? null,
    }
    const json = JSON.stringify(payload)
    return createHash('sha256').update(json).digest('hex')
  }

  private async markAsRead(
    scope: { recipientId?: number; customerId?: number; audience: NotificationAudience },
    ids: number[] | null,
    markAll: boolean,
  ) {
    const where: Prisma.NotificationWhereInput = {
      audience: scope.audience,
    }
    if (scope.recipientId) {
      where.recipientId = scope.recipientId
    }
    if (scope.customerId) {
      where.customerId = scope.customerId
    }
    if (ids && ids.length) {
      where.id = { in: ids }
    }
    if (!markAll && (!ids || !ids.length)) {
      return
    }
    await this.prisma.notification.updateMany({
      where,
      data: {
        readed: true,
        readAt: new Date(),
      },
    })
  }

  private async listNotifications(
    scope: { recipientId?: number; customerId?: number; audience: NotificationAudience },
    query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1
    const pageSize = query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 20
    const skip = (page - 1) * pageSize

    const where: Prisma.NotificationWhereInput = {
      audience: scope.audience,
    }
    if (scope.recipientId) {
      where.recipientId = scope.recipientId
    }
    if (scope.customerId) {
      where.customerId = scope.customerId
    }
    if (query.eventType) {
      where.eventType = query.eventType
    }
    if (query.channel) {
      where.channel = query.channel
    }
    if (query.unreadOnly) {
      where.readAt = null
    }
    if (query.since) {
      where.createdAt = { gte: query.since }
    }

    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          ...where,
          readAt: null,
        },
      }),
    ])

    return {
      items: items.map((item) => this.serialize(item)),
      meta: {
        page,
        pageSize,
        total,
      unread,
      },
    }
  }

  private async deleteNotifications(
    scope: { recipientId?: number; customerId?: number; audience: NotificationAudience },
    ids: number[] | null,
    deleteAll: boolean,
  ) {
    const where: Prisma.NotificationWhereInput = {
      audience: scope.audience,
    }
    if (scope.recipientId) {
      where.recipientId = scope.recipientId
    }
    if (scope.customerId) {
      where.customerId = scope.customerId
    }
    if (ids && ids.length) {
      where.id = { in: ids }
    }
    if (!deleteAll && (!ids || !ids.length)) {
      return
    }
    await this.prisma.notification.deleteMany({ where })
  }

  private serialize(record: Notification): NotificationListItem {
    return {
      id: record.id,
      eventType: record.eventType ?? null,
      audience: record.audience ?? null,
      channel: record.channel ?? null,
      deliveryStatus: record.deliveryStatus,
      title: record.title ?? null,
      body: record.body ?? null,
      metadata: this.deserializeMetadata(record.metadata),
      readAt: record.readAt ? record.readAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      orderId: record.orderId ?? null,
      paymentId: record.paymentId ?? null,
    }
  }

  private serializeMetadata(metadata?: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
    if (!metadata) {
      return undefined
    }
    return JSON.parse(
      JSON.stringify(metadata, (_, value) => {
        if (value instanceof Date) {
          return value.toISOString()
        }
        return value
      }),
    )
  }

  private deserializeMetadata(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
    if (metadata === null || metadata === undefined) {
      return null
    }
    if (typeof metadata === 'object') {
      return metadata as Record<string, unknown>
    }
    try {
      return JSON.parse(String(metadata)) as Record<string, unknown>
    } catch (error) {
      this.logger.warn(`Failed to parse notification metadata: ${(error as Error).message}`)
      return null
    }
  }
}
