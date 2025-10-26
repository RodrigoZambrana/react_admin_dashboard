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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const sign_in_dto_1 = require("./dto/sign-in.dto");
const sign_up_dto_1 = require("./dto/sign-up.dto");
const bcrypt = require("bcrypt");
const avatar_1 = require("../common/uploads/avatar");
const prisma_service_1 = require("../prisma/prisma.service");
const user_activity_service_1 = require("../user-activity/user-activity.service");
const auth_config_1 = require("./auth.config");
let AuthController = class AuthController {
    auth;
    prisma;
    userActivity;
    constructor(auth, prisma, userActivity) {
        this.auth = auth;
        this.prisma = prisma;
        this.userActivity = userActivity;
    }
    buildAuthCookieOptions() {
        const secure = process.env.NODE_ENV !== 'development';
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            path: '/',
            maxAge: auth_config_1.SESSION_TTL_SECONDS,
        };
    }
    async signIn(dto, req, reply) {
        await this.auth.verifyRecaptcha(dto.recaptchaToken, req.ip);
        const user = await this.auth.validateUser(dto.email, dto.password);
        await this.userActivity.recordLogin(user.id, req);
        const result = this.auth.signToken(user);
        reply.setCookie('access_token', result.token, this.buildAuthCookieOptions());
        return {
            ...result,
            user: {
                ...result.user,
                avatar: (0, avatar_1.resolveAvatarPublicUrl)(req, result.user.avatar),
            },
        };
    }
    async signUp(dto, req, reply) {
        const normalizedEmail = dto.email.trim().toLowerCase();
        const normalizedName = dto.name.trim();
        const normalizedLastName = dto.lastName !== undefined && dto.lastName !== null
            ? dto.lastName.trim()
            : undefined;
        const exists = await this.prisma.user.findFirst({
            where: { email: normalizedEmail },
        });
        if (!exists) {
            await this.prisma.user.create({
                data: {
                    name: normalizedName,
                    lastName: normalizedLastName,
                    email: normalizedEmail,
                    passwordHash: await bcrypt.hash(dto.password, 10),
                    role: 'USER',
                },
            });
        }
        const user = await this.auth.validateUser(normalizedEmail, dto.password);
        const result = this.auth.signToken(user);
        await this.userActivity.recordLogin(user.id, req);
        reply.setCookie('access_token', result.token, this.buildAuthCookieOptions());
        return {
            ...result,
            user: {
                ...result.user,
                avatar: (0, avatar_1.resolveAvatarPublicUrl)(req, result.user.avatar),
            },
        };
    }
    async signOut(reply) {
        reply.clearCookie('access_token', { path: '/' });
        return { ok: true };
    }
    async forgotPassword() {
        return { ok: true };
    }
    async resetPassword() {
        return { ok: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('/sign-in'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sign_in_dto_1.SignInDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signIn", null);
__decorate([
    (0, common_1.Post)('/sign-up'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sign_up_dto_1.SignUpDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signUp", null);
__decorate([
    (0, common_1.Post)('/sign-out'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signOut", null);
__decorate([
    (0, common_1.Post)('/forgot-password'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('/reset-password'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        prisma_service_1.PrismaService,
        user_activity_service_1.UserActivityService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map