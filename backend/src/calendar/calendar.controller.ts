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
  NotFoundException,
  Res,
  BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { FastifyReply } from 'fastify'

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

  private readonly defaultEventTypes = [
    { name: 'Reunión', color: '#2563eb' },
    { name: 'Tarea', color: '#059669' },
    { name: 'Taller', color: '#7c3aed' },
    { name: 'Otro', color: '#6b7280' },
  ]

  private async ensureEventTypesSeeded() {
    const count = await this.prisma.calendarEventType.count()
    if (count === 0) {
      await this.prisma.calendarEventType.createMany({
        data: this.defaultEventTypes,
        skipDuplicates: true,
      })
    }
  }

  private mergeEventMetadata(
    metadata: unknown,
    eventType?: { id: number; name: string; color: string | null } | null,
  ) {
    const base =
      metadata && typeof metadata === 'object'
        ? { ...(metadata as Record<string, unknown>) }
        : {}
    if (eventType) {
      base.eventTypeId = eventType.id
      base.eventTypeName = eventType.name
      if (eventType.color && !base.color) {
        base.color = eventType.color
      }
    }
    return Object.keys(base).length > 0 ? base : null
  }

  private decodeAttachmentContent(content: unknown): Buffer | null {
    if (typeof content !== 'string') {
      return null
    }
    const normalized = content.includes(',') ? content.split(',').pop() || '' : content
    if (!normalized) {
      return null
    }
    try {
      return Buffer.from(normalized, 'base64')
    } catch (error) {
      return null
    }
  }

  private extractAttachmentPayload(
    input: unknown,
  ): {
    keepIds: number[]
    newAttachments: {
      name: string
      mimeType: string | null
      size: number | null
      content: Buffer
    }[]
    provided: boolean
  } {
    if (!Array.isArray(input)) {
      return { keepIds: [], newAttachments: [], provided: false }
    }
    const keepIds = new Set<number>()
    const newAttachments: {
      name: string
      mimeType: string | null
      size: number | null
      content: Buffer
    }[] = []

    input.forEach((raw) => {
      if (!raw || typeof raw !== 'object') {
        return
      }
      const attachment = raw as Record<string, unknown>
      const contentCandidate =
        attachment.content || attachment.contentBase64 || attachment.data
      if (contentCandidate) {
        const buffer = this.decodeAttachmentContent(contentCandidate)
        if (buffer) {
          const name =
            typeof attachment.name === 'string' && attachment.name.trim().length
              ? attachment.name.trim()
              : 'attachment'
          const mimeType =
            typeof attachment.type === 'string' && attachment.type.trim().length
              ? attachment.type.trim()
              : typeof attachment.mimeType === 'string' &&
                (attachment.mimeType as string).trim().length
              ? (attachment.mimeType as string).trim()
              : null
          const sizeValue = Number(attachment.size)
          newAttachments.push({
            name,
            mimeType,
            size: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : buffer.length,
            content: buffer,
          })
        }
        return
      }

      const idValue = Number(attachment.id)
      if (Number.isFinite(idValue) && idValue > 0) {
        keepIds.add(idValue)
      }
    })

    return { keepIds: Array.from(keepIds), newAttachments, provided: true }
  }

  private toPrismaBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(buffer.length)
    bytes.set(buffer)
    return bytes
  }

  private serializeAttachments(
    attachments: {
      id: number
      name: string
      mimeType: string | null
      size: number | null
      content: Buffer | Uint8Array
    }[] = [],
    options: { includeContent?: boolean } = {},
  ) {
    const { includeContent = false } = options
    return attachments.map((attachment) => {
      const base: Record<string, unknown> = {
        id: attachment.id,
        name: attachment.name,
        type: attachment.mimeType ?? undefined,
        size: attachment.size ?? undefined,
        url: `/calendar/attachments/${attachment.id}`,
      }
      if (includeContent) {
        base.content = attachment.content?.toString('base64')
      }
      return base
    })
  }

  private serializeComments(
    comments: {
      id: number
      message: string
      createdAt: Date
      author?: { id: number; name: string | null; email: string; img?: string | null } | null
    }[] = [],
  ) {
    return comments
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((comment) => ({
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt,
        author: comment.author
          ? {
              id: comment.author.id,
              name: comment.author.name,
              email: comment.author.email,
              img: comment.author.img,
            }
          : null,
      }))
  }

  private normalizeEvent(
    event: any,
    options: { includeAttachmentContent?: boolean } = {},
  ) {
    if (!event) {
      return event
    }
    const { includeAttachmentContent = false } = options
    const { attachments = [], ...rest } = event
    const metadata = this.mergeEventMetadata(rest.metadata, rest.eventType ?? undefined)
    const comments = Array.isArray(rest.comments)
      ? this.serializeComments(
          rest.comments.map((comment: any) => ({
            id: comment.id,
            message: comment.message,
            createdAt: comment.createdAt,
            author: comment.author
              ? {
                  id: comment.author.id,
                  name: comment.author.name,
                  email: comment.author.email,
                  img: comment.author.img,
                }
              : null,
          })),
        )
      : []
    return {
      ...rest,
      attachments: this.serializeAttachments(attachments, {
        includeContent: includeAttachmentContent,
      }),
      color: rest.color || rest.eventType?.color || null,
      metadata,
      comments,
    }
  }

  private async resolveEventType(
    idInput?: unknown,
    nameInput?: unknown,
  ): Promise<{ id: number; name: string; color: string | null } | null> {
    await this.ensureEventTypesSeeded()
    if (idInput !== undefined && idInput !== null && idInput !== '') {
      const parsed = Number(idInput)
      if (Number.isFinite(parsed)) {
        const found = await this.prisma.calendarEventType.findUnique({
          where: { id: parsed },
        })
        if (found) {
          return found
        }
      }
    }
    const name = typeof nameInput === 'string' ? nameInput.trim() : ''
    if (name) {
      const found = await this.prisma.calendarEventType.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      })
      if (found) {
        return found
      }
    }
    const fallback = await this.prisma.calendarEventType.findFirst({
      orderBy: { id: 'asc' },
    })
    return fallback
  }

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
    await this.ensureEventTypesSeeded()
    const events = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: { eventType: true, attachments: true },
    })
    const normalized = events.map((event) =>
      this.normalizeEvent(event, { includeAttachmentContent: false }),
    )
    return { events: normalized }
  }

  @Get('activity')
  async activity(@Query('id') id?: string) {
    const eid = Number(id)
    if (!eid) return {}
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eid },
      include: {
        createdBy: true,
        project: true,
        task: true,
        attachments: true,
        eventType: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
      },
    })
    return this.normalizeEvent(event, { includeAttachmentContent: true }) || {}
  }

  @Post('events')
  async createEvent(@Body() body: any, @Request() req: any) {
    const userId = Number(req?.user?.sub)
    const metadata = typeof body.metadata === 'string' ? safeJsonParse(body.metadata) : body.metadata
    const resolvedType = await this.resolveEventType(body.eventTypeId, body.eventType ?? body.type)
    const attachmentPayload = this.extractAttachmentPayload(body.attachments)
    const data: any = {
      title: body.title,
      description: body.description,
      type: body.type,
      startAt: body.startAt ? new Date(body.startAt) : new Date(),
      endAt: body.endAt ? new Date(body.endAt) : null,
      allDay: !!body.allDay,
      location: body.location,
      color: body.color || resolvedType?.color || null,
      metadata: this.mergeEventMetadata(metadata, resolvedType),
      projectId: body.projectId || null,
      taskId: body.taskId || null,
      createdById: userId || null,
      eventTypeId: resolvedType?.id ?? null,
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const createdEvent = await tx.calendarEvent.create({ data })
      if (attachmentPayload.newAttachments.length) {
        await tx.calendarEventAttachment.createMany({
          data: attachmentPayload.newAttachments.map((attachment) => ({
            eventId: createdEvent.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            content: this.toPrismaBytes(attachment.content),
          })),
        })
      }
      const finalEvent = await tx.calendarEvent.findUnique({
        where: { id: createdEvent.id },
        include: { eventType: true, attachments: true },
      })
      return finalEvent
    })
    return this.normalizeEvent(created, { includeAttachmentContent: false })
  }

  @Put('events/:id')
  async updateEvent(@Param('id') id: string, @Body() body: any) {
    const metadata = typeof body.metadata === 'string' ? safeJsonParse(body.metadata) : body.metadata
    const resolvedType = await this.resolveEventType(body.eventTypeId, body.eventType ?? body.type)
    const attachmentPayload = this.extractAttachmentPayload(body.attachments)
    const data: any = {
      title: body.title,
      description: body.description,
      type: body.type,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      allDay: body.allDay,
      location: body.location,
      color:
        body.color !== undefined
          ? body.color || resolvedType?.color || null
          : resolvedType?.color || undefined,
      metadata:
        metadata !== undefined
        ? this.mergeEventMetadata(metadata, resolvedType)
        : undefined,
      projectId: body.projectId,
      taskId: body.taskId,
      eventTypeId: resolvedType ? resolvedType.id : body.eventTypeId === null ? null : undefined,
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedEvent = await tx.calendarEvent.update({
        where: { id: Number(id) },
        data,
      })

      if (attachmentPayload.provided) {
        const keepIds = attachmentPayload.keepIds
        if (keepIds.length) {
          await tx.calendarEventAttachment.deleteMany({
            where: {
              eventId: updatedEvent.id,
              id: { notIn: keepIds },
            },
          })
        } else {
          await tx.calendarEventAttachment.deleteMany({
            where: { eventId: updatedEvent.id },
          })
        }

        if (attachmentPayload.newAttachments.length) {
          await tx.calendarEventAttachment.createMany({
            data: attachmentPayload.newAttachments.map((attachment) => ({
              eventId: updatedEvent.id,
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
              content: this.toPrismaBytes(attachment.content),
            })),
          })
        }
      }

      const finalEvent = await tx.calendarEvent.findUnique({
        where: { id: updatedEvent.id },
        include: { eventType: true, attachments: true },
      })
      return finalEvent
    })

    return this.normalizeEvent(updated, { includeAttachmentContent: false })
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    await this.prisma.calendarEvent.delete({ where: { id: Number(id) } })
    return true
  }

  @Get('attachments/:id')
  async getAttachment(
    @Param('id') id: string,
    @Query('mode') mode = 'attachment',
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const attachmentId = Number(id)
    if (!attachmentId || Number.isNaN(attachmentId)) {
      throw new NotFoundException('Attachment not found')
    }

    const attachment = await this.prisma.calendarEventAttachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      throw new NotFoundException('Attachment not found')
    }

    const mimeType = attachment.mimeType || 'application/octet-stream'
    const disposition = mode === 'inline' ? 'inline' : 'attachment'
    const fallbackName = attachment.name?.trim().length
      ? attachment.name.trim()
      : 'attachment'
    const encodedFileName = encodeURIComponent(fallbackName)

    res.header('Content-Type', mimeType)
    res.header(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodedFileName}`,
    )
    if (attachment.size ?? attachment.content.length) {
      res.header(
        'Content-Length',
        String(attachment.size ?? attachment.content.length ?? 0),
      )
    }

    return res.send(Buffer.from(attachment.content))
  }

  @Delete('attachments/:id')
  async deleteAttachment(@Param('id') id: string) {
    const attachmentId = Number(id)
    if (!attachmentId || Number.isNaN(attachmentId)) {
      throw new NotFoundException('Attachment not found')
    }

    try {
      await this.prisma.calendarEventAttachment.delete({ where: { id: attachmentId } })
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException('Attachment not found')
      }
      throw error
    }

    return { success: true }
  }

  @Post('events/:id/comments')
  async addComment(
    @Param('id') id: string,
    @Body('message') message: string,
    @Request() req: any,
  ) {
    const eventId = Number(id)
    if (!eventId || Number.isNaN(eventId)) {
      throw new NotFoundException('Event not found')
    }
    const trimmed = typeof message === 'string' ? message.trim() : ''
    if (!trimmed) {
      throw new BadRequestException('Comment message is required')
    }

    const eventExists = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    })
    if (!eventExists) {
      throw new NotFoundException('Event not found')
    }

    const userId = Number(req?.user?.sub)

    const created = await this.prisma.calendarEventComment.create({
      data: {
        eventId,
        userId: Number.isFinite(userId) ? userId : null,
        message: trimmed,
      },
      include: {
        author: true,
      },
    })

    const [serialized] = this.serializeComments([
      {
        id: created.id,
        message: created.message,
        createdAt: created.createdAt,
        author: created.author
          ? {
              id: created.author.id,
              name: created.author.name,
              email: created.author.email,
              img: created.author.img,
            }
          : null,
      },
    ])

    return serialized
  }

  @Delete('comments/:id')
  async deleteComment(@Param('id') id: string, @Request() req: any) {
    const commentId = Number(id)
    if (!commentId || Number.isNaN(commentId)) {
      throw new NotFoundException('Comment not found')
    }

    const comment = await this.prisma.calendarEventComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    })

    if (!comment) {
      throw new NotFoundException('Comment not found')
    }

    const userId = Number(req?.user?.sub)
    const userRole = String(req?.user?.role || '')
    const isSuperAdmin = userRole.toUpperCase() === 'SUPERADMIN'
    const isOwner = Number.isFinite(userId) && comment.userId === userId
    if (!isSuperAdmin && !isOwner) {
      throw new BadRequestException('You cannot delete this comment')
    }

    await this.prisma.calendarEventComment.delete({ where: { id: commentId } })
    return { success: true }
  }

  @Put('comments/:id')
  async updateComment(
    @Param('id') id: string,
    @Body('message') message: string,
    @Request() req: any,
  ) {
    const commentId = Number(id)
    if (!commentId || Number.isNaN(commentId)) {
      throw new NotFoundException('Comment not found')
    }

    const trimmed = typeof message === 'string' ? message.trim() : ''
    if (!trimmed) {
      throw new BadRequestException('Comment message is required')
    }

    const existing = await this.prisma.calendarEventComment.findUnique({
      where: { id: commentId },
      include: { author: true },
    })

    if (!existing) {
      throw new NotFoundException('Comment not found')
    }

    const userId = Number(req?.user?.sub)
    const userRole = String(req?.user?.role || '')
    const isSuperAdmin = userRole.toUpperCase() === 'SUPERADMIN'
    const isOwner = Number.isFinite(userId) && existing.userId === userId
    if (!isSuperAdmin && !isOwner) {
      throw new BadRequestException('You cannot update this comment')
    }

    const updated = await this.prisma.calendarEventComment.update({
      where: { id: commentId },
      data: { message: trimmed },
      include: { author: true },
    })

    const [serialized] = this.serializeComments([
      {
        id: updated.id,
        message: updated.message,
        createdAt: updated.createdAt,
        author: updated.author
          ? {
              id: updated.author.id,
              name: updated.author.name,
              email: updated.author.email,
              img: updated.author.img,
            }
          : null,
      },
    ])

    return serialized
  }
}
