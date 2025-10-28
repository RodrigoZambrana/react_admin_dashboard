import { Body, Controller, Get, Post, Query, Req, Sse, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { Observable } from 'rxjs'
import { StorefrontJwtGuard } from '../storefront/storefront-jwt.guard'
import { NotificationsService } from './notifications.service'
import { NotificationStreamService } from './notification-stream.service'
import { NotificationQueryDto } from './dto/notification-query.dto'
import { MarkNotificationsReadDto } from './dto/mark-read.dto'
import { StorefrontJwtPayload } from '../storefront/storefront-jwt.strategy'
import { MessageEvent } from '@nestjs/common'

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
    return this.notifications.listForCustomer(customerId, {
      page: query.page,
      pageSize: query.pageSize,
      eventType: query.eventType ?? null,
      channel: query.channel ?? null,
      unreadOnly: query.unreadOnly ?? false,
      since: query.since ?? null,
    })
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

  @Sse('events')
  streamEvents(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }): Observable<MessageEvent> {
    const customerId = Number(req.user?.sub)
    return this.stream.streamForCustomer(customerId)
  }
}
