"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const safeJsonParse = (value) => {
    try {
        return JSON.parse(value);
    }
    catch (error) {
        return null;
    }
};
let CalendarController = class CalendarController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    defaultEventTypes = [
        { name: 'Reunión', color: '#2563eb' },
        { name: 'Tarea', color: '#059669' },
        { name: 'Taller', color: '#7c3aed' },
        { name: 'Otro', color: '#6b7280' },
    ];
    async ensureEventTypesSeeded() {
        const count = await this.prisma.calendarEventType.count();
        if (count === 0) {
            await this.prisma.calendarEventType.createMany({
                data: this.defaultEventTypes,
                skipDuplicates: true,
            });
        }
    }
    mergeEventMetadata(metadata, eventType) {
        const base = metadata && typeof metadata === 'object'
            ? { ...metadata }
            : {};
        if (eventType) {
            base.eventTypeId = eventType.id;
            base.eventTypeName = eventType.name;
            if (eventType.color && !base.color) {
                base.color = eventType.color;
            }
        }
        return Object.keys(base).length > 0 ? base : null;
    }
    decodeAttachmentContent(content) {
        if (typeof content !== 'string') {
            return null;
        }
        const normalized = content.includes(',') ? content.split(',').pop() || '' : content;
        if (!normalized) {
            return null;
        }
        try {
            return Buffer.from(normalized, 'base64');
        }
        catch (error) {
            return null;
        }
    }
    toPrismaBytes(bytes) {
        if (bytes === undefined || bytes === null) {
            return bytes;
        }
        if (Buffer.isBuffer(bytes)) {
            return Uint8Array.from(bytes);
        }
        return bytes;
    }
    extractAttachmentPayload(input) {
        if (!Array.isArray(input)) {
            return { keepIds: [], newAttachments: [], provided: false };
        }
        const keepIds = new Set();
        const newAttachments = [];
        input.forEach((raw) => {
            if (!raw || typeof raw !== 'object') {
                return;
            }
            const attachment = raw;
            const contentCandidate = attachment.content || attachment.contentBase64 || attachment.data;
            if (contentCandidate) {
                const buffer = this.decodeAttachmentContent(contentCandidate);
                if (buffer) {
                    const name = typeof attachment.name === 'string' && attachment.name.trim().length
                        ? attachment.name.trim()
                        : 'attachment';
                    const mimeType = typeof attachment.type === 'string' && attachment.type.trim().length
                        ? attachment.type.trim()
                        : typeof attachment.mimeType === 'string' &&
                            attachment.mimeType.trim().length
                            ? attachment.mimeType.trim()
                            : null;
                    const sizeValue = Number(attachment.size);
                    newAttachments.push({
                        name,
                        mimeType,
                        size: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : buffer.length,
                        content: buffer,
                    });
                }
                return;
            }
            const idValue = Number(attachment.id);
            if (Number.isFinite(idValue) && idValue > 0) {
                keepIds.add(idValue);
            }
        });
        return { keepIds: Array.from(keepIds), newAttachments, provided: true };
    }
    serializeAttachments(attachments = [], options = {}) {
        const { includeContent = false } = options;
        return attachments.map((attachment) => {
            const base = {
                id: attachment.id,
                name: attachment.name,
                type: attachment.mimeType ?? undefined,
                size: attachment.size ?? undefined,
                url: `/calendar/attachments/${attachment.id}`,
            };
            if (includeContent && attachment.content) {
                const nodeBuffer = Buffer.isBuffer(attachment.content)
                    ? attachment.content
                    : Buffer.from(attachment.content);
                base.content = nodeBuffer.toString('base64');
            }
            return base;
        });
    }
    serializeComments(comments = []) {
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
        }));
    }
    normalizeEvent(event, options = {}) {
        if (!event) {
            return event;
        }
        const { includeAttachmentContent = false } = options;
        const { attachments = [], ...rest } = event;
        const metadata = this.mergeEventMetadata(rest.metadata, rest.eventType ?? undefined);
        const comments = Array.isArray(rest.comments)
            ? this.serializeComments(rest.comments.map((comment) => ({
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
            })))
            : [];
        return {
            ...rest,
            attachments: this.serializeAttachments(attachments, {
                includeContent: includeAttachmentContent,
            }),
            color: rest.color || rest.eventType?.color || null,
            metadata,
            comments,
        };
    }
    async resolveEventType(idInput, nameInput) {
        await this.ensureEventTypesSeeded();
        if (idInput !== undefined && idInput !== null && idInput !== '') {
            const parsed = Number(idInput);
            if (Number.isFinite(parsed)) {
                const found = await this.prisma.calendarEventType.findUnique({
                    where: { id: parsed },
                });
                if (found) {
                    return found;
                }
            }
        }
        const name = typeof nameInput === 'string' ? nameInput.trim() : '';
        if (name) {
            const found = await this.prisma.calendarEventType.findFirst({
                where: {
                    name: {
                        equals: name,
                        mode: 'insensitive',
                    },
                },
            });
            if (found) {
                return found;
            }
        }
        const fallback = await this.prisma.calendarEventType.findFirst({
            orderBy: { id: 'asc' },
        });
        return fallback;
    }
    async events(start, end, projectId, createdById, taskId) {
        const where = {};
        if (start || end) {
            where.startAt = {};
            if (start)
                where.startAt.gte = new Date(start);
            if (end)
                where.startAt.lte = new Date(end);
        }
        if (projectId)
            where.projectId = Number(projectId);
        if (createdById)
            where.createdById = Number(createdById);
        if (taskId)
            where.taskId = Number(taskId);
        await this.ensureEventTypesSeeded();
        const events = await this.prisma.calendarEvent.findMany({
            where,
            orderBy: { startAt: 'asc' },
            include: { eventType: true, attachments: true },
        });
        const normalized = events.map((event) => this.normalizeEvent(event, { includeAttachmentContent: false }));
        return { events: normalized };
    }
    async activity(id) {
        const eid = Number(id);
        if (!eid)
            return {};
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
        });
        return this.normalizeEvent(event, { includeAttachmentContent: true }) || {};
    }
    async createEvent(body, req) {
        const userId = Number(req?.user?.sub);
        const metadata = typeof body.metadata === 'string' ? safeJsonParse(body.metadata) : body.metadata;
        const resolvedType = await this.resolveEventType(body.eventTypeId, body.eventType ?? body.type);
        const attachmentPayload = this.extractAttachmentPayload(body.attachments);
        const data = {
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
        };
        const created = await this.prisma.$transaction(async (tx) => {
            const createdEvent = await tx.calendarEvent.create({ data });
            if (attachmentPayload.newAttachments.length) {
                await tx.calendarEventAttachment.createMany({
                    data: attachmentPayload.newAttachments.map((attachment) => ({
                        eventId: createdEvent.id,
                        name: attachment.name,
                        mimeType: attachment.mimeType,
                        size: attachment.size,
                        content: this.toPrismaBytes(attachment.content),
                    })),
                });
            }
            const finalEvent = await tx.calendarEvent.findUnique({
                where: { id: createdEvent.id },
                include: { eventType: true, attachments: true },
            });
            return finalEvent;
        });
        return this.normalizeEvent(created, { includeAttachmentContent: false });
    }
    async updateEvent(id, body) {
        const metadata = typeof body.metadata === 'string' ? safeJsonParse(body.metadata) : body.metadata;
        const resolvedType = await this.resolveEventType(body.eventTypeId, body.eventType ?? body.type);
        const attachmentPayload = this.extractAttachmentPayload(body.attachments);
        const data = {
            title: body.title,
            description: body.description,
            type: body.type,
            startAt: body.startAt ? new Date(body.startAt) : undefined,
            endAt: body.endAt ? new Date(body.endAt) : undefined,
            allDay: body.allDay,
            location: body.location,
            color: body.color !== undefined
                ? body.color || resolvedType?.color || null
                : resolvedType?.color || undefined,
            metadata: metadata !== undefined
                ? this.mergeEventMetadata(metadata, resolvedType)
                : undefined,
            projectId: body.projectId,
            taskId: body.taskId,
            eventTypeId: resolvedType ? resolvedType.id : body.eventTypeId === null ? null : undefined,
        };
        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedEvent = await tx.calendarEvent.update({
                where: { id: Number(id) },
                data,
            });
            if (attachmentPayload.provided) {
                const keepIds = attachmentPayload.keepIds;
                if (keepIds.length) {
                    await tx.calendarEventAttachment.deleteMany({
                        where: {
                            eventId: updatedEvent.id,
                            id: { notIn: keepIds },
                        },
                    });
                }
                else {
                    await tx.calendarEventAttachment.deleteMany({
                        where: { eventId: updatedEvent.id },
                    });
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
                    });
                }
            }
            const finalEvent = await tx.calendarEvent.findUnique({
                where: { id: updatedEvent.id },
                include: { eventType: true, attachments: true },
            });
            return finalEvent;
        });
        return this.normalizeEvent(updated, { includeAttachmentContent: false });
    }
    async deleteEvent(id) {
        await this.prisma.calendarEvent.delete({ where: { id: Number(id) } });
        return true;
    }
    async getAttachment(id, mode = 'attachment', res) {
        const attachmentId = Number(id);
        if (!attachmentId || Number.isNaN(attachmentId)) {
            throw new common_1.NotFoundException('Attachment not found');
        }
        const attachment = await this.prisma.calendarEventAttachment.findUnique({
            where: { id: attachmentId },
        });
        if (!attachment) {
            throw new common_1.NotFoundException('Attachment not found');
        }
        const mimeType = attachment.mimeType || 'application/octet-stream';
        const disposition = mode === 'inline' ? 'inline' : 'attachment';
        const fallbackName = attachment.name?.trim().length
            ? attachment.name.trim()
            : 'attachment';
        const encodedFileName = encodeURIComponent(fallbackName);
        res.header('Content-Type', mimeType);
        res.header('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedFileName}`);
        if (attachment.size ?? attachment.content.length) {
            res.header('Content-Length', String(attachment.size ?? attachment.content.length ?? 0));
        }
        return res.send(Buffer.from(attachment.content));
    }
    async deleteAttachment(id) {
        const attachmentId = Number(id);
        if (!attachmentId || Number.isNaN(attachmentId)) {
            throw new common_1.NotFoundException('Attachment not found');
        }
        try {
            await this.prisma.calendarEventAttachment.delete({ where: { id: attachmentId } });
        }
        catch (error) {
            if (error?.code === 'P2025') {
                throw new common_1.NotFoundException('Attachment not found');
            }
            throw error;
        }
        return { success: true };
    }
    async addComment(id, message, req) {
        const eventId = Number(id);
        if (!eventId || Number.isNaN(eventId)) {
            throw new common_1.NotFoundException('Event not found');
        }
        const trimmed = typeof message === 'string' ? message.trim() : '';
        if (!trimmed) {
            throw new common_1.BadRequestException('Comment message is required');
        }
        const eventExists = await this.prisma.calendarEvent.findUnique({
            where: { id: eventId },
            select: { id: true },
        });
        if (!eventExists) {
            throw new common_1.NotFoundException('Event not found');
        }
        const userId = Number(req?.user?.sub);
        const created = await this.prisma.calendarEventComment.create({
            data: {
                eventId,
                userId: Number.isFinite(userId) ? userId : null,
                message: trimmed,
            },
            include: {
                author: true,
            },
        });
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
        ]);
        return serialized;
    }
    async deleteComment(id, req) {
        const commentId = Number(id);
        if (!commentId || Number.isNaN(commentId)) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const comment = await this.prisma.calendarEventComment.findUnique({
            where: { id: commentId },
            select: { id: true, userId: true },
        });
        if (!comment) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const userId = Number(req?.user?.sub);
        const userRole = String(req?.user?.role || '');
        const isSuperAdmin = userRole.toUpperCase() === 'SUPERADMIN';
        const isOwner = Number.isFinite(userId) && comment.userId === userId;
        if (!isSuperAdmin && !isOwner) {
            throw new common_1.BadRequestException('You cannot delete this comment');
        }
        await this.prisma.calendarEventComment.delete({ where: { id: commentId } });
        return { success: true };
    }
    async updateComment(id, message, req) {
        const commentId = Number(id);
        if (!commentId || Number.isNaN(commentId)) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const trimmed = typeof message === 'string' ? message.trim() : '';
        if (!trimmed) {
            throw new common_1.BadRequestException('Comment message is required');
        }
        const existing = await this.prisma.calendarEventComment.findUnique({
            where: { id: commentId },
            include: { author: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const userId = Number(req?.user?.sub);
        const userRole = String(req?.user?.role || '');
        const isSuperAdmin = userRole.toUpperCase() === 'SUPERADMIN';
        const isOwner = Number.isFinite(userId) && existing.userId === userId;
        if (!isSuperAdmin && !isOwner) {
            throw new common_1.BadRequestException('You cannot update this comment');
        }
        const updated = await this.prisma.calendarEventComment.update({
            where: { id: commentId },
            data: { message: trimmed },
            include: { author: true },
        });
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
        ]);
        return serialized;
    }
};
exports.CalendarController = CalendarController;
__decorate([
    (0, common_1.Get)('events'),
    __param(0, (0, common_1.Query)('start')),
    __param(1, (0, common_1.Query)('end')),
    __param(2, (0, common_1.Query)('projectId')),
    __param(3, (0, common_1.Query)('createdById')),
    __param(4, (0, common_1.Query)('taskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "events", null);
__decorate([
    (0, common_1.Get)('activity'),
    __param(0, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "activity", null);
__decorate([
    (0, common_1.Post)('events'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Put)('events/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "updateEvent", null);
__decorate([
    (0, common_1.Delete)('events/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "deleteEvent", null);
__decorate([
    (0, common_1.Get)('attachments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('mode')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "getAttachment", null);
__decorate([
    (0, common_1.Delete)('attachments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "deleteAttachment", null);
__decorate([
    (0, common_1.Post)('events/:id/comments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('message')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "addComment", null);
__decorate([
    (0, common_1.Delete)('comments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "deleteComment", null);
__decorate([
    (0, common_1.Put)('comments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('message')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CalendarController.prototype, "updateComment", null);
exports.CalendarController = CalendarController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('calendar'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CalendarController);
//# sourceMappingURL=calendar.controller.js.map