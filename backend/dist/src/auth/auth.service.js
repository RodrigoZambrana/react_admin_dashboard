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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = require("bcrypt");
const jwt_1 = require("@nestjs/jwt");
const auth_config_1 = require("./auth.config");
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const normalizeLanguagePreference = (value) => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized.startsWith('es')) {
        return 'es';
    }
    if (normalized.startsWith('en')) {
        return 'en';
    }
    return 'en';
};
let AuthService = class AuthService {
    prisma;
    jwt;
    constructor(prisma, jwt) {
        this.prisma = prisma;
        this.jwt = jwt;
    }
    async verifyRecaptcha(token, remoteIp) {
        const isEnabled = String(process.env.RECAPTCHA_ENABLED || '').toLowerCase() === 'true';
        if (!isEnabled) {
            return;
        }
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) {
            throw new common_1.UnauthorizedException('No se configuró la clave de reCAPTCHA.');
        }
        if (!token) {
            throw new common_1.UnauthorizedException('No se pudo validar el reCAPTCHA.');
        }
        const form = new URLSearchParams({
            secret: secretKey,
            response: token,
        });
        if (remoteIp) {
            form.set('remoteip', remoteIp);
        }
        let response;
        try {
            response = await fetch(RECAPTCHA_VERIFY_URL, {
                method: 'POST',
                body: form,
            });
        }
        catch (error) {
            throw new common_1.UnauthorizedException('No se pudo validar el reCAPTCHA.');
        }
        if (!response.ok) {
            throw new common_1.UnauthorizedException('No se pudo validar el reCAPTCHA.');
        }
        const payload = (await response.json());
        if (!payload.success) {
            throw new common_1.UnauthorizedException('No se pudo validar el reCAPTCHA.');
        }
    }
    async validateUser(email, pass) {
        const normalizedEmail = (email || '').trim();
        if (!normalizedEmail) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const lowered = normalizedEmail.toLowerCase();
        const user = (await this.prisma.user.findFirst({
            where: { email: { equals: lowered, mode: 'insensitive' } },
        })) || null;
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const ok = await bcrypt.compare(pass, user.passwordHash);
        if (!ok)
            throw new common_1.UnauthorizedException('Invalid credentials');
        return user;
    }
    signToken(user) {
        const lang = normalizeLanguagePreference(user.lang);
        const payload = {
            sub: user.id,
            email: user.email,
            authority: [user.role],
            avatar: user.img || '',
            role: user.role,
            name: user.name || '',
            lastName: user.lastName || '',
            lang,
        };
        const token = this.jwt.sign(payload);
        const expiresAt = new Date(Date.now() + auth_config_1.SESSION_TTL_MILLISECONDS).toISOString();
        return {
            token,
            expiresAt,
            user: {
                authority: [user.role],
                avatar: user.img || '',
                email: user.email,
                name: user.name || '',
                lastName: user.lastName || '',
                lang,
            },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map