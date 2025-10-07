import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private prisma: PrismaService) {}

  private async buildBoardResponse() {
    const columns = await this.prisma.activityColumn.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        tickets: {
          orderBy: { order: 'asc' },
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    const boardColumns = columns.map((column) => ({
      id: column.id,
      title: column.title,
      sortOrder: column.sortOrder,
      tickets: column.tickets.map((ticket) => ({
        id: ticket.id,
        columnId: ticket.columnId,
        name: ticket.name,
        description: ticket.description,
        priority: ticket.priority,
        labels: ticket.labels,
        dueDate: ticket.dueDate ? ticket.dueDate.getTime() : null,
        order: ticket.order,
        cover: ticket.cover,
        members: ticket.members.map((member) => ({
          id: member.userId,
          name: member.user?.name ?? '',
          email: member.user?.email ?? '',
          img: member.user?.img ?? '',
        })),
      })),
    }))

    return {
      ordered: boardColumns.map((column) => column.id),
      columns: boardColumns,
    }
  }

  @Get('board')
  async getBoard() {
    return this.buildBoardResponse()
  }

  @Get('members')
  async getMembers() {
    const allUsers = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
    })

    const participantMembers = await this.prisma.activityTicketMember.findMany({
      distinct: ['userId'],
      include: {
        user: true,
      },
    })

    const toMemberPayload = (user: { id: number; name: string | null; email: string; img: string | null }) => ({
      id: user.id,
      name: user.name ?? '',
      email: user.email,
      img: user.img ?? '',
    })

    return {
      participantMembers: participantMembers.map((member) =>
        toMemberPayload({
          id: member.user?.id ?? member.userId,
          name: member.user?.name ?? '',
          email: member.user?.email ?? '',
          img: member.user?.img ?? '',
        }),
      ),
      allMembers: allUsers.map((user) => toMemberPayload(user)),
    }
  }

  @Post('columns')
  async createColumn(@Body() body: { title: string }) {
    const trimmedTitle = body.title?.trim()
    if (!trimmedTitle) {
      throw new BadRequestException('Column title is required')
    }

    const lastColumn = await this.prisma.activityColumn.findFirst({
      orderBy: { sortOrder: 'desc' },
    })

    await this.prisma.activityColumn.create({
      data: {
        title: trimmedTitle,
        sortOrder: (lastColumn?.sortOrder ?? 0) + 1,
      },
    })

    return this.buildBoardResponse()
  }

  @Patch('columns/reorder')
  async reorderColumns(@Body() body: { columnIds: number[] }) {
    const updates = body.columnIds.map((columnId, index) =>
      this.prisma.activityColumn.update({
        where: { id: columnId },
        data: { sortOrder: index },
      }),
    )

    await this.prisma.$transaction(updates)
    return this.buildBoardResponse()
  }

  @Patch('columns/:id')
  async updateColumn(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string },
  ) {
    const data: { title?: string } = {}
    if (body.title !== undefined) {
      const newTitle = body.title.trim()
      if (!newTitle) {
        throw new BadRequestException('Column title is required')
      }
      data.title = newTitle
    }

    await this.prisma.activityColumn.update({
      where: { id },
      data,
    })

    return this.buildBoardResponse()
  }

  @Delete('columns/:id')
  async deleteColumn(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.activityColumn.delete({ where: { id } })
    return this.buildBoardResponse()
  }

  @Post('tickets')
  async createTicket(
    @Body()
    body: {
      columnId: number
      name: string
      description?: string
      priority?: string
      labels?: string[]
      dueDate?: string | number | null
      memberIds?: number[]
    },
  ) {
    const column = await this.prisma.activityColumn.findUnique({ where: { id: body.columnId } })
    if (!column) {
      throw new NotFoundException('Column not found')
    }

    const lastTicket = await this.prisma.activityTicket.findFirst({
      where: { columnId: body.columnId },
      orderBy: { order: 'desc' },
    })

    await this.prisma.activityTicket.create({
      data: {
        columnId: body.columnId,
        name: body.name.trim() || 'Untitled Ticket',
        description: body.description?.trim() || null,
        priority: body.priority || null,
        labels: body.labels ?? [],
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        order: (lastTicket?.order ?? 0) + 1,
        members: body.memberIds
          ? {
              createMany: {
                data: body.memberIds.map((userId) => ({ userId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
    })

    return this.buildBoardResponse()
  }

  @Patch('tickets/reorder')
  async reorderTickets(
    @Body()
    body: {
      columnOrders: { columnId: number; ticketIds: number[] }[]
    },
  ) {
    const operations = body.columnOrders.flatMap(({ columnId, ticketIds }) =>
      ticketIds.map((ticketId, index) =>
        this.prisma.activityTicket.update({
          where: { id: ticketId },
          data: { columnId, order: index },
        }),
      ),
    )

    await this.prisma.$transaction(operations)
    return this.buildBoardResponse()
  }

  @Patch('tickets/:id')
  async updateTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      columnId?: number
      name?: string
      description?: string | null
      priority?: string | null
      labels?: string[]
      dueDate?: string | number | null
      memberIds?: number[]
      order?: number
    },
  ) {
    const data: Record<string, unknown> = {}

    if (body.columnId !== undefined) {
      data.columnId = body.columnId
    }
    if (body.name !== undefined) {
      data.name = body.name.trim() || 'Untitled Ticket'
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null
    }
    if (body.priority !== undefined) {
      data.priority = body.priority
    }
    if (body.labels !== undefined) {
      data.labels = body.labels
    }
    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    }
    if (body.order !== undefined) {
      data.order = body.order
    }

    await this.prisma.activityTicket.update({
      where: { id },
      data,
    })

    if (body.memberIds) {
      await this.prisma.activityTicketMember.deleteMany({ where: { ticketId: id } })
      if (body.memberIds.length > 0) {
        await this.prisma.activityTicketMember.createMany({
          data: body.memberIds.map((userId) => ({ ticketId: id, userId })),
          skipDuplicates: true,
        })
      }
    }

    return this.buildBoardResponse()
  }

  @Delete('tickets/:id')
  async deleteTicket(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.activityTicket.delete({ where: { id } })
    return this.buildBoardResponse()
  }
}
