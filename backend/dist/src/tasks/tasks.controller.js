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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let TasksController = class TasksController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(dto) {
        const where = dto.query
            ? {
                OR: [
                    { subject: { contains: dto.query, mode: 'insensitive' } },
                    { description: { contains: dto.query, mode: 'insensitive' } },
                ],
            }
            : {};
        if (dto.projectId)
            where.projectId = Number(dto.projectId);
        if (dto.createdById)
            where.createdById = Number(dto.createdById);
        const total = await this.prisma.task.count({ where });
        const sortKey = (dto.sort?.key || '').toString();
        const sortOrderRaw = (dto.sort?.order || '').toString().toLowerCase();
        const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;
        const orderBy = [];
        if (sortKey && sortOrder) {
            switch (sortKey) {
                case 'code':
                    orderBy.push({ code: sortOrder });
                    break;
                case 'subject':
                    orderBy.push({ subject: sortOrder });
                    break;
                case 'status':
                    orderBy.push({ status: sortOrder });
                    break;
                case 'priority':
                    orderBy.push({ priority: sortOrder });
                    break;
                case 'dueDate':
                    orderBy.push({ dueDate: sortOrder });
                    break;
            }
        }
        orderBy.push({ id: 'desc' });
        const data = await this.prisma.task.findMany({
            where,
            orderBy,
            include: { project: true, assignees: { include: { user: true } } },
            skip: (dto.pageIndex - 1) * dto.pageSize,
            take: dto.pageSize,
        });
        return { data, total };
    }
    async detail(id) {
        const data = await this.prisma.task.findUnique({
            where: { id: Number(id) },
            include: { project: true, assignees: { include: { user: true } }, events: true },
        });
        return data;
    }
    async create(body, req) {
        const userId = Number(req?.user?.sub);
        const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
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
        });
        return created;
    }
    async update(id, body) {
        const assigneeIds = body.assigneeIds;
        const tid = Number(id);
        if (Array.isArray(assigneeIds)) {
            await this.prisma.taskAssignee.deleteMany({ where: { taskId: tid } });
            await this.prisma.taskAssignee.createMany({
                data: assigneeIds.map((uid) => ({ taskId: tid, userId: Number(uid) })),
            });
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
        });
        return updated;
    }
    async delete(id) {
        const tid = Number(id);
        await this.prisma.taskAssignee.deleteMany({ where: { taskId: tid } });
        await this.prisma.calendarEvent.updateMany({ data: { taskId: null }, where: { taskId: tid } });
        await this.prisma.task.delete({ where: { id: tid } });
        return true;
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Post)('list'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "delete", null);
exports.TasksController = TasksController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('tasks'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map