import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import type { FastifyRequest } from 'fastify'
import type { Observable } from 'rxjs'
import { NotificationsService } from './notifications.service'
import { NotificationStreamService } from './notification-stream.service'
import { NotificationQueryDto } from './dto/notification-query.dto'
import { MarkNotificationsReadDto } from './dto/mark-read.dto'

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStreamService,
  ) {}

  @Get()
  async list(@Req() req: FastifyRequest & { user: { sub: string } }, @Query() query: NotificationQueryDto) {
    const userId = Number(req.user?.sub)
    return this.notifications.listForUser(userId, {
      page: query.page,
      pageSize: query.pageSize,
      eventType: query.eventType ?? null,
      channel: query.channel ?? null,
      unreadOnly: query.unreadOnly ?? false,
      since: query.since ?? null,
    })
  }

  @Get('unread-count')
  async unreadCount(@Req() req: FastifyRequest & { user: { sub: string } }) {
    const userId = Number(req.user?.sub)
    const count = await this.notifications.countUnreadForUser(userId)
    return { count }
  }

  @Post('read')
  async markAsRead(
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Body() body: MarkNotificationsReadDto,
  ) {
    const userId = Number(req.user?.sub)
    const ids = body.ids ?? []
    const markAll = body.markAll ?? false
    await this.notifications.markAsReadForUser(userId, ids, markAll)
    return { success: true }
  }

  @Sse('events')
  streamEvents(@Req() req: FastifyRequest & { user: { sub: string } }): Observable<MessageEvent> {
    const userId = Number(req.user?.sub)
    return this.stream.streamForUser(userId)
  }
}
