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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const avatar_1 = require("../common/uploads/avatar");
const client_1 = require("@prisma/client");
const multipart_1 = require("../common/uploads/multipart");
const bcrypt = require("bcrypt");
const assert_strong_password_1 = require("../common/validation/assert-strong-password");
const DEFAULT_TEMP_PASSWORD = process.env.DEFAULT_USER_TEMP_PASSWORD || 'TempPass@123!';
const normalizeNullableString = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};
const normalizeOptionalUppercase = (value) => {
    const normalized = normalizeNullableString(value);
    return normalized ? normalized.toUpperCase() : normalized;
};
const normalizeRequiredString = (value) => value.trim();
let UsersController = class UsersController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const data = await this.prisma.user.findMany({
            orderBy: { id: 'desc' },
            select: {
                id: true,
                name: true,
                lastName: true,
                email: true,
                img: true,
                role: true,
                country: true,
                countryCode: true,
                city: true,
            },
        });
        return data.map((u) => ({
            ...u,
            name: normalizeRequiredString(u.name || ''),
            lastName: normalizeNullableString(u.lastName) || '',
            role: u.role,
            country: normalizeNullableString(u.country),
            countryCode: normalizeOptionalUppercase(u.countryCode),
            city: normalizeNullableString(u.city),
        }));
    }
    async create(req) {
        const { fields, file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        const email = normalizeRequiredString(fields.email ?? '').toLowerCase();
        const avatarPath = file
            ? await (0, avatar_1.persistAvatarFile)(file)
            : (0, avatar_1.normalizeAvatarPath)(fields.img);
        const role = (fields.role || 'user').toLowerCase();
        try {
            const hashedTempPassword = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10);
            const created = await this.prisma.user.create({
                data: {
                    name: normalizeRequiredString(fields.name ?? ''),
                    lastName: normalizeNullableString(fields.lastName),
                    email,
                    img: avatarPath ?? null,
                    role: (role || 'user').toUpperCase(),
                    country: normalizeNullableString(fields.country),
                    countryCode: normalizeOptionalUppercase(fields.countryCode),
                    city: normalizeNullableString(fields.city),
                    passwordHash: hashedTempPassword,
                },
                select: {
                    id: true,
                    name: true,
                    lastName: true,
                    email: true,
                    img: true,
                    role: true,
                    country: true,
                    countryCode: true,
                    city: true,
                },
            });
            return {
                ...created,
                name: normalizeRequiredString(created.name || ''),
                lastName: normalizeNullableString(created.lastName) || '',
                role: created.role,
                country: normalizeNullableString(created.country),
                countryCode: normalizeOptionalUppercase(created.countryCode),
                city: normalizeNullableString(created.city),
            };
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.BadRequestException({
                    message: 'users.validation.duplicateEmail',
                    errors: [{ field: 'email', key: 'users.validation.duplicateEmail' }],
                });
            }
            throw error;
        }
    }
    async update(id, req) {
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            throw new common_1.BadRequestException('users.validation.invalidUser');
        }
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { img: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('users.validation.invalidUser');
        }
        const { fields, file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        const currentAvatar = (0, avatar_1.normalizeAvatarPath)(existing.img);
        let nextAvatar = currentAvatar;
        if (file) {
            nextAvatar = await (0, avatar_1.persistAvatarFile)(file, currentAvatar);
        }
        else if (fields.img !== undefined) {
            nextAvatar = (0, avatar_1.normalizeAvatarPath)(fields.img);
        }
        const nameUpdate = fields.name === undefined
            ? undefined
            : normalizeRequiredString(fields.name);
        const lastNameUpdate = fields.lastName === undefined
            ? undefined
            : normalizeNullableString(fields.lastName);
        const emailUpdate = fields.email === undefined
            ? undefined
            : normalizeRequiredString(fields.email).toLowerCase();
        const roleUpdate = fields.role === undefined
            ? undefined
            : fields.role.toUpperCase();
        const countryUpdate = fields.country === undefined
            ? undefined
            : normalizeNullableString(fields.country);
        const countryCodeUpdate = fields.countryCode === undefined
            ? undefined
            : normalizeOptionalUppercase(fields.countryCode);
        const cityUpdate = fields.city === undefined
            ? undefined
            : normalizeNullableString(fields.city);
        try {
            const updated = await this.prisma.user.update({
                where: { id: userId },
                data: {
                    name: nameUpdate,
                    lastName: lastNameUpdate,
                    email: emailUpdate,
                    img: nextAvatar ?? null,
                    role: roleUpdate,
                    country: countryUpdate,
                    countryCode: countryCodeUpdate,
                    city: cityUpdate,
                },
                select: {
                    id: true,
                    name: true,
                    lastName: true,
                    email: true,
                    img: true,
                    role: true,
                    country: true,
                    countryCode: true,
                    city: true,
                },
            });
            return {
                ...updated,
                name: normalizeRequiredString(updated.name || ''),
                lastName: normalizeNullableString(updated.lastName) || '',
                role: updated.role,
                country: normalizeNullableString(updated.country),
                countryCode: normalizeOptionalUppercase(updated.countryCode),
                city: normalizeNullableString(updated.city),
            };
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.BadRequestException({
                    message: 'users.validation.duplicateEmail',
                    errors: [{ field: 'email', key: 'users.validation.duplicateEmail' }],
                });
            }
            throw error;
        }
    }
    async delete(id, req) {
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            throw new common_1.BadRequestException('users.validation.invalidUser');
        }
        const authUser = req.user;
        const requesterId = Number(authUser?.sub);
        if (Number.isInteger(requesterId) && requesterId === userId) {
            throw new common_1.BadRequestException('users.validation.cannotDeleteSelf');
        }
        try {
            await this.prisma.user.delete({
                where: { id: userId },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025') {
                throw new common_1.BadRequestException('users.validation.invalidUser');
            }
            throw error;
        }
        return { success: true };
    }
    async updatePassword(id, body) {
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            throw new common_1.BadRequestException('users.validation.invalidUser');
        }
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('users.validation.invalidUser');
        }
        if (typeof body?.password !== 'string') {
            throw new common_1.BadRequestException('users.validation.passwordRequired');
        }
        const password = normalizeRequiredString(body.password);
        if (!password.length) {
            throw new common_1.BadRequestException('users.validation.passwordRequired');
        }
        (0, assert_strong_password_1.assertStrongPassword)(password, 'password');
        const hashed = await bcrypt.hash(password, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashed },
        });
        return { success: true };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "delete", null);
__decorate([
    (0, common_1.Put)(':id/password'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updatePassword", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersController);
//# sourceMappingURL=users.controller.js.map