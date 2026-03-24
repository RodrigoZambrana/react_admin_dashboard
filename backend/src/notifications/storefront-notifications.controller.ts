import { Body, Controller, Delete, Get, Param, Post, Query, Req, Sse, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { StorefrontJwtGuard } from '../storefront/storefront-jwt.guard'
import { NotificationsService } from './notifications.service'
import { NotificationStreamService } from './notification-stream.service'
import { NotificationQueryDto } from './dto/notification-query.dto'
import { MarkNotificationsReadDto } from './dto/mark-read.dto'
import { DeleteNotificationsDto } from './dto/delete-notifications.dto'
import { StorefrontJwtPayload } from '../storefront/storefront-jwt.strategy'
import { MessageEvent } from '@nestjs/common'
import type { NotificationListItem } from './notifications.types'

type StorefrontNotificationItem = Omit<NotificationListItem, 'orderId' | 'paymentId'> & {
  metadata: Record<string, unknown> | null
}

@UseGuards(StorefrontJwtGuard)
@Controller('storefront/account/notifications')
export class StorefrontNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStreamService,
  ) {}

  @Get()
  async list(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Query() query: NotificationQueryDto,
  ) {
    const customerId = Number(req.user?.sub)
    const response = await this.notifications.listForCustomer(customerId, {
      page: query.page,
      pageSize: query.pageSize,
      eventType: query.eventType ?? null,
      channel: query.channel ?? null,
      unreadOnly: query.unreadOnly ?? false,
      since: query.since ?? null,
    })
    return {
      ...response,
      items: response.items.map((item) => this.toStorefrontNotification(item)),
    }
  }

  @Get('unread-count')
  async unreadCount(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const customerId = Number(req.user?.sub)
    const count = await this.notifications.countUnreadForCustomer(customerId)
    return { count }
  }

  @Post('read')
  async markAsRead(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() body: MarkNotificationsReadDto,
  ) {
    const customerId = Number(req.user?.sub)
    const ids = body.ids ?? []
    const markAll = body.markAll ?? false
    await this.notifications.markAsReadForCustomer(customerId, ids, markAll)
    return { success: true }
  }

  @Delete()
  async deleteMany(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() body: DeleteNotificationsDto,
  ) {
    const customerId = Number(req.user?.sub)
    const ids = body.ids ?? []
    const deleteAll = body.deleteAll ?? false
    await this.notifications.deleteForCustomer(customerId, ids, deleteAll)
    return { success: true }
  }

  @Delete(':id')
  async deleteOne(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id') id: string,
  ) {
    const customerId = Number(req.user?.sub)
    const numericId = Number(id)
    await this.notifications.deleteForCustomer(
      customerId,
      Number.isFinite(numericId) ? [numericId] : [],
      false,
    )
    return { success: true }
  }

  @Sse('events')
  streamEvents(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }): Observable<MessageEvent> {
    const customerId = Number(req.user?.sub)
    return this.stream.streamForCustomer(customerId).pipe(
      map((event) => ({
        ...event,
        data: this.toStorefrontNotification(event.data as NotificationListItem),
      })),
    )
  }

  private toStorefrontNotification(item: NotificationListItem): StorefrontNotificationItem {
    return {
      id: item.id,
      eventType: item.eventType,
      audience: item.audience,
      channel: item.channel,
      deliveryStatus: item.deliveryStatus,
      title: item.title,
      body: item.body,
      metadata: this.sanitizeMetadata(item.metadata),
      readAt: item.readAt,
      createdAt: item.createdAt,
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!metadata) {
      return null
    }

    const allowedKeys = new Set([
      'type',
      'redirectPath',
      'orderUuid',
      'orderNumber',
      'amount',
      'currency',
      'amountFormatted',
      'method',
      'status',
      'statusCode',
      'previousStatus',
      'previousStatusCode',
    ])

    return Object.fromEntries(Object.entries(metadata).filter(([key]) => allowedKeys.has(key)))
  }
}
