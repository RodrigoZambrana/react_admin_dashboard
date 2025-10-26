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
exports.ActivitiesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let ActivitiesController = class ActivitiesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async buildBoardResponse() {
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
        });
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
        }));
        return {
            ordered: boardColumns.map((column) => column.id),
            columns: boardColumns,
        };
    }
    async getBoard() {
        return this.buildBoardResponse();
    }
    async getMembers() {
        const allUsers = await this.prisma.user.findMany({
            orderBy: { name: 'asc' },
        });
        const participantMembers = await this.prisma.activityTicketMember.findMany({
            distinct: ['userId'],
            include: {
                user: true,
            },
        });
        const toMemberPayload = (user) => ({
            id: user.id,
            name: user.name ?? '',
            email: user.email,
            img: user.img ?? '',
        });
        return {
            participantMembers: participantMembers.map((member) => toMemberPayload({
                id: member.user?.id ?? member.userId,
                name: member.user?.name ?? '',
                email: member.user?.email ?? '',
                img: member.user?.img ?? '',
            })),
            allMembers: allUsers.map((user) => toMemberPayload(user)),
        };
    }
    async createColumn(body) {
        const trimmedTitle = body.title?.trim();
        if (!trimmedTitle) {
            throw new common_1.BadRequestException('Column title is required');
        }
        const lastColumn = await this.prisma.activityColumn.findFirst({
            orderBy: { sortOrder: 'desc' },
        });
        await this.prisma.activityColumn.create({
            data: {
                title: trimmedTitle,
                sortOrder: (lastColumn?.sortOrder ?? 0) + 1,
            },
        });
        return this.buildBoardResponse();
    }
    async reorderColumns(body) {
        const updates = body.columnIds.map((columnId, index) => this.prisma.activityColumn.update({
            where: { id: columnId },
            data: { sortOrder: index },
        }));
        await this.prisma.$transaction(updates);
        return this.buildBoardResponse();
    }
    async updateColumn(id, body) {
        const data = {};
        if (body.title !== undefined) {
            const newTitle = body.title.trim();
            if (!newTitle) {
                throw new common_1.BadRequestException('Column title is required');
            }
            data.title = newTitle;
        }
        await this.prisma.activityColumn.update({
            where: { id },
            data,
        });
        return this.buildBoardResponse();
    }
    async deleteColumn(id) {
        await this.prisma.activityColumn.delete({ where: { id } });
        return this.buildBoardResponse();
    }
    async createTicket(body) {
        const column = await this.prisma.activityColumn.findUnique({ where: { id: body.columnId } });
        if (!column) {
            throw new common_1.NotFoundException('Column not found');
        }
        const lastTicket = await this.prisma.activityTicket.findFirst({
            where: { columnId: body.columnId },
            orderBy: { order: 'desc' },
        });
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
        });
        return this.buildBoardResponse();
    }
    async reorderTickets(body) {
        const operations = body.columnOrders.flatMap(({ columnId, ticketIds }) => ticketIds.map((ticketId, index) => this.prisma.activityTicket.update({
            where: { id: ticketId },
            data: { columnId, order: index },
        })));
        await this.prisma.$transaction(operations);
        return this.buildBoardResponse();
    }
    async updateTicket(id, body) {
        const data = {};
        if (body.columnId !== undefined) {
            data.columnId = body.columnId;
        }
        if (body.name !== undefined) {
            data.name = body.name.trim() || 'Untitled Ticket';
        }
        if (body.description !== undefined) {
            data.description = body.description?.trim() || null;
        }
        if (body.priority !== undefined) {
            data.priority = body.priority;
        }
        if (body.labels !== undefined) {
            data.labels = body.labels;
        }
        if (body.dueDate !== undefined) {
            data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
        }
        if (body.order !== undefined) {
            data.order = body.order;
        }
        await this.prisma.activityTicket.update({
            where: { id },
            data,
        });
        if (body.memberIds) {
            await this.prisma.activityTicketMember.deleteMany({ where: { ticketId: id } });
            if (body.memberIds.length > 0) {
                await this.prisma.activityTicketMember.createMany({
                    data: body.memberIds.map((userId) => ({ ticketId: id, userId })),
                    skipDuplicates: true,
                });
            }
        }
        return this.buildBoardResponse();
    }
    async deleteTicket(id) {
        await this.prisma.activityTicket.delete({ where: { id } });
        return this.buildBoardResponse();
    }
};
exports.ActivitiesController = ActivitiesController;
__decorate([
    (0, common_1.Get)('board'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "getBoard", null);
__decorate([
    (0, common_1.Get)('members'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "getMembers", null);
__decorate([
    (0, common_1.Post)('columns'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "createColumn", null);
__decorate([
    (0, common_1.Patch)('columns/reorder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "reorderColumns", null);
__decorate([
    (0, common_1.Patch)('columns/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "updateColumn", null);
__decorate([
    (0, common_1.Delete)('columns/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "deleteColumn", null);
__decorate([
    (0, common_1.Post)('tickets'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "createTicket", null);
__decorate([
    (0, common_1.Patch)('tickets/reorder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "reorderTickets", null);
__decorate([
    (0, common_1.Patch)('tickets/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "updateTicket", null);
__decorate([
    (0, common_1.Delete)('tickets/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "deleteTicket", null);
exports.ActivitiesController = ActivitiesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('activities'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActivitiesController);
//# sourceMappingURL=activities.controller.js.map