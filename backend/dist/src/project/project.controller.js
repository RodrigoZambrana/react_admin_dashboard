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
exports.ProjectController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let ProjectController = class ProjectController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async dashboard() {
        const totalTasks = await this.prisma.task.count();
        const tasks = await this.prisma.task.findMany({ include: { assignees: { include: { user: true } }, project: true } });
        const projects = await this.prisma.project.findMany();
        const events = await this.prisma.calendarEvent.findMany({ orderBy: { startAt: 'asc' }, take: 8 });
        const finished = tasks.filter((t) => ['done', 'closed', 'completed'].includes((t.status || '').toLowerCase())).length;
        const onGoing = Math.max(0, totalTasks - finished);
        const makeChart = () => ({
            onGoing,
            finished,
            total: totalTasks,
            series: [
                { name: 'On Going', data: Array.from({ length: 12 }, () => Math.round(onGoing / 12 + Math.random() * 4)) },
                { name: 'Finished', data: Array.from({ length: 12 }, () => Math.round(finished / 12 + Math.random() * 3)) },
            ],
            range: Array.from({ length: 12 }, (_, i) => `W${i + 1}`),
        });
        const myTasksData = tasks.slice(0, 8).map((t) => ({
            taskId: String(t.id),
            taskSubject: t.subject,
            priority: t.priority || 1,
            assignees: t.assignees.map((a) => ({ id: String(a.userId), name: a.user?.name || '', email: a.user?.email || '', img: a.user?.img || '' })),
        }));
        const scheduleData = events.map((e) => ({ id: String(e.id), time: new Date(e.startAt).toISOString(), eventName: e.title, desciption: e.description || '', type: e.type }));
        const projectsData = await Promise.all(projects.map(async (p) => {
            const prjTasks = tasks.filter((t) => t.projectId === p.id);
            const comp = prjTasks.filter((t) => ['done', 'closed', 'completed'].includes((t.status || '').toLowerCase())).length;
            const total = prjTasks.length;
            const progression = total ? Math.round((comp / total) * 100) : 0;
            const dayleft = p.endDate ? Math.max(0, Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86400000)) : 0;
            const members = Array.from(new Set(prjTasks.flatMap((t) => t.assignees.map((a) => a.user?.name || 'Member'))))
                .slice(0, 5)
                .map((name) => ({ name, img: '' }));
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
            };
        }));
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
        };
    }
    async list(body) {
        const orderBy = body.sort === 'asc' ? { name: 'asc' } : body.sort === 'desc' ? { name: 'desc' } : { id: 'desc' };
        const where = body.search ? { name: { contains: body.search, mode: 'insensitive' } } : {};
        const rows = await this.prisma.project.findMany({ where, orderBy });
        return rows;
    }
    async add(body) {
        await this.prisma.project.create({ data: { name: body.name, description: body.desc || '', code: body.category || '' } });
        return true;
    }
    boards() {
        return { boards: [] };
    }
    members() {
        return { members: [] };
    }
    ticketDetail() {
        return { id: 'T-1', subject: 'Sample ticket' };
    }
};
exports.ProjectController = ProjectController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('list'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('list/add'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "add", null);
__decorate([
    (0, common_1.Post)('scrum-board/boards'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectController.prototype, "boards", null);
__decorate([
    (0, common_1.Post)('scrum-board/members'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectController.prototype, "members", null);
__decorate([
    (0, common_1.Get)('scrum-board/tickets/detail'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectController.prototype, "ticketDetail", null);
exports.ProjectController = ProjectController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('project'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProjectController);
//# sourceMappingURL=project.controller.js.map