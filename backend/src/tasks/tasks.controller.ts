import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { TableQueryDto } from '../crm/dto/table-query.dto'

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private prisma: PrismaService) {}

  @Post('list')
  async list(@Body() dto: TableQueryDto & { projectId?: number; createdById?: number }) {
    const where: any = dto.query
      ? {
          OR: [
            { subject: { contains: dto.query, mode: 'insensitive' as any } },
            { description: { contains: dto.query, mode: 'insensitive' as any } },
          ],
        }
      : {}
    if (dto.projectId) where.projectId = Number(dto.projectId)
    if (dto.createdById) where.createdById = Number(dto.createdById)
    const total = await this.prisma.task.count({ where })
    const data = await this.prisma.task.findMany({
      where,
      orderBy: { id: 'desc' },
      include: { project: true, assignees: { include: { user: true } } },
      skip: (dto.pageIndex - 1) * dto.pageSize,
      take: dto.pageSize,
    })
    return { data, total }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const data = await this.prisma.task.findUnique({
      where: { id: Number(id) },
      include: { project: true, assignees: { include: { user: true } }, events: true },
    })
    return data
  }

  @Post()
  async create(@Body() body: any, @Request() req: any) {
    const userId = Number(req?.user?.sub)
    const assigneeIds: number[] = Array.isArray(body.assigneeIds) ? body.assigneeIds : []
    const created = await this.prisma.task.create({
      data: {
        code: body.code,
        subject: body.subject,
        description: body.description,
        priority: typeof body.priority === 'number' ? body.priority : 1,
        status: body.status,
        projectId: body.projectId || null,
        createdById: userId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignees: {
          create: assigneeIds.map((uid) => ({ userId: Number(uid) })),
        },
      },
      include: { assignees: true },
    })
    return created
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const assigneeIds: number[] | undefined = body.assigneeIds
    const tid = Number(id)
    if (Array.isArray(assigneeIds)) {
      // reset assignees
      await this.prisma.taskAssignee.deleteMany({ where: { taskId: tid } })
      await this.prisma.taskAssignee.createMany({
        data: assigneeIds.map((uid) => ({ taskId: tid, userId: Number(uid) })),
      })
    }
    const updated = await this.prisma.task.update({
      where: { id: tid },
      data: {
        code: body.code,
        subject: body.subject,
        description: body.description,
        priority: typeof body.priority === 'number' ? body.priority : undefined,
        status: body.status,
        projectId: body.projectId,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      },
    })
    return updated
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const tid = Number(id)
    await this.prisma.taskAssignee.deleteMany({ where: { taskId: tid } })
    await this.prisma.calendarEvent.updateMany({ data: { taskId: null }, where: { taskId: tid } })
    await this.prisma.task.delete({ where: { id: tid } })
    return true
  }
}
