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
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let NotificationController = class NotificationController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(req) {
        const userId = Number(req?.user?.sub);
        const items = await this.prisma.notification.findMany({
            where: userId
                ? { OR: [{ recipientId: userId }, { recipientId: null }] }
                : {},
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
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
        }));
    }
    async count(req) {
        const userId = Number(req?.user?.sub);
        const where = userId
            ? { readed: false, OR: [{ recipientId: userId }, { recipientId: null }] }
            : { readed: false };
        const count = await this.prisma.notification.count({ where });
        return { count };
    }
    async markRead(id) {
        await this.prisma.notification.update({ where: { id: Number(id) }, data: { readed: true } });
        return true;
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Get)('list'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('count'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "count", null);
__decorate([
    (0, common_1.Put)('read/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markRead", null);
exports.NotificationController = NotificationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('notification'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map