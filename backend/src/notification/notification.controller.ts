import { Controller, Get, Param, Put, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private prisma: PrismaService) {}

  @Get('list')
  async list(@Request() req: any) {
    const userId = Number(req?.user?.sub)
    const items = await this.prisma.notification.findMany({
      where: userId
        ? { OR: [{ recipientId: userId }, { recipientId: null }] }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return items.map((n) => ({
      id: String(n.id),
      target: n.target || '',
      description: n.description || '',
      date: n.createdAt.toISOString(),
      image: n.image || '',
      type: n.type,
      location: n.location || '',
      locationLabel: n.locationLabel || '',
      status: n.status || '',
      readed: n.readed,
    }))
  }

  @Get('count')
  async count(@Request() req: any) {
    const userId = Number(req?.user?.sub)
    const where = userId
      ? { readed: false, OR: [{ recipientId: userId }, { recipientId: null }] as any }
      : { readed: false }
    const count = await this.prisma.notification.count({ where })
    return { count }
  }

  @Put('read/:id')
  async markRead(@Param('id') id: string) {
    await this.prisma.notification.update({ where: { id: Number(id) }, data: { readed: true } })
    return true
  }
}

