import { Controller, Get, Post, Put, UseGuards, Body } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard)
@Controller('project')
export class ProjectController {
  constructor(private prisma: PrismaService) {}
  @Get('dashboard')
  async dashboard() {
    const totalTasks = await this.prisma.task.count()
    const tasks = await this.prisma.task.findMany({ include: { assignees: { include: { user: true } }, project: true } })
    const projects = await this.prisma.project.findMany()
    const events = await this.prisma.calendarEvent.findMany({ orderBy: { startAt: 'asc' }, take: 8 })

    const finished = tasks.filter((t) => ['done', 'closed', 'completed'].includes((t.status || '').toLowerCase())).length
    const onGoing = Math.max(0, totalTasks - finished)

    const makeChart = () => ({
      onGoing,
      finished,
      total: totalTasks,
      series: [
        { name: 'On Going', data: Array.from({ length: 12 }, () => Math.round(onGoing / 12 + Math.random() * 4)) },
        { name: 'Finished', data: Array.from({ length: 12 }, () => Math.round(finished / 12 + Math.random() * 3)) },
      ],
      range: Array.from({ length: 12 }, (_, i) => `W${i + 1}`),
    })

    const myTasksData = tasks.slice(0, 8).map((t) => ({
      taskId: String(t.id),
      taskSubject: t.subject,
      priority: t.priority || 1,
      assignees: t.assignees.map((a) => ({ id: String(a.userId), name: a.user?.name || '', email: a.user?.email || '', img: a.user?.img || '' })),
    }))

    const scheduleData = events.map((e) => ({ id: String(e.id), time: new Date(e.startAt).toISOString(), eventName: e.title, desciption: e.description || '', type: e.type }))

    const projectsData = await Promise.all(projects.map(async (p) => {
      const prjTasks = tasks.filter((t) => t.projectId === p.id)
      const comp = prjTasks.filter((t) => ['done', 'closed', 'completed'].includes((t.status || '').toLowerCase())).length
      const total = prjTasks.length
      const progression = total ? Math.round((comp / total) * 100) : 0
      const dayleft = p.endDate ? Math.max(0, Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86400000)) : 0
      const members = Array.from(new Set(prjTasks.flatMap((t) => t.assignees.map((a) => a.user?.name || 'Member'))))
        .slice(0, 5)
        .map((name) => ({ name, img: '' }))
      return {
        id: p.id,
        name: p.name,
        category: p.code || 'General',
        desc: p.description || '',
        attachmentCount: 0,
        totalTask: total,
        completedTask: comp,
        progression,
        dayleft,
        status: progression > 75 ? 'green' : progression > 50 ? 'orange' : progression > 25 ? 'cyan' : 'none',
        member: members,
      }
    }))

    return {
      taskCount: totalTasks,
      projectOverviewData: {
        chart: {
          daily: makeChart(),
          weekly: makeChart(),
          monthly: makeChart(),
        },
      },
      myTasksData,
      scheduleData,
      activitiesData: [],
      projectsData,
    }
  }

  @Post('list')
  async list(@Body() body: { sort?: 'asc' | 'desc'; search?: string }) {
    const orderBy = body.sort === 'asc' ? { name: 'asc' as const } : body.sort === 'desc' ? { name: 'desc' as const } : { id: 'desc' as const }
    const where = body.search ? { name: { contains: body.search, mode: 'insensitive' as any } } : {}
    const rows = await this.prisma.project.findMany({ where, orderBy })
    return rows
  }

  @Put('list/add')
  async add(@Body() body: { id?: number; name: string; category?: string; desc?: string }) {
    await this.prisma.project.create({ data: { name: body.name, description: body.desc || '', code: body.category || '' } })
    return true
  }

  @Post('scrum-board/boards')
  boards() {
    return { boards: [] }
  }

  @Post('scrum-board/members')
  members() {
    return { members: [] }
  }

  @Get('scrum-board/tickets/detail')
  ticketDetail() {
    return { id: 'T-1', subject: 'Sample ticket' }
  }
}
