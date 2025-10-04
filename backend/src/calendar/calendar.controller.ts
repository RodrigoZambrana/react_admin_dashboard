import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private prisma: PrismaService) {}

  @Get('events')
  async events(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('projectId') projectId?: string,
    @Query('createdById') createdById?: string,
    @Query('taskId') taskId?: string,
  ) {
    const where: any = {}
    if (start || end) {
      where.startAt = {}
      if (start) where.startAt.gte = new Date(start)
      if (end) where.startAt.lte = new Date(end)
    }
    if (projectId) where.projectId = Number(projectId)
    if (createdById) where.createdById = Number(createdById)
    if (taskId) where.taskId = Number(taskId)
    const events = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startAt: 'asc' },
    })
    return { events }
  }

  @Get('activity')
  async activity(@Query('id') id?: string) {
    const eid = Number(id)
    if (!eid) return {}
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eid },
      include: { createdBy: true, project: true, task: true },
    })
    return event || {}
  }

  @Post('events')
  async createEvent(@Body() body: any, @Request() req: any) {
    const userId = Number(req?.user?.sub)
    const metadata = typeof body.metadata === 'string' ? safeJsonParse(body.metadata) : body.metadata
    const data: any = {
      title: body.title,
      description: body.description,
      type: body.type,
      startAt: body.startAt ? new Date(body.startAt) : new Date(),
      endAt: body.endAt ? new Date(body.endAt) : null,
      allDay: !!body.allDay,
      location: body.location,
      color: body.color || null,
      metadata: metadata || null,
      projectId: body.projectId || null,
      taskId: body.taskId || null,
      createdById: userId || null,
    }
    const created = await this.prisma.calendarEvent.create({ data })
    return created
  }

  @Put('events/:id')
  async updateEvent(@Param('id') id: string, @Body() body: any) {
    const metadata = typeof body.metadata === 'string' ? safeJsonParse(body.metadata) : body.metadata
    const data: any = {
      title: body.title,
      description: body.description,
      type: body.type,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      allDay: body.allDay,
      location: body.location,
      color: body.color !== undefined ? body.color : undefined,
      metadata: metadata !== undefined ? metadata : undefined,
      projectId: body.projectId,
      taskId: body.taskId,
    }
    const updated = await this.prisma.calendarEvent.update({ where: { id: Number(id) }, data })
    return updated
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    await this.prisma.calendarEvent.delete({ where: { id: Number(id) } })
    return true
  }
}
