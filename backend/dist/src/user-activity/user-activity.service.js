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
exports.UserActivityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("crypto");
const Activity = {
    LOGIN: 'LOGIN',
    DEVICE_SIGN_IN: 'DEVICE_SIGN_IN',
    PROFILE_UPDATE: 'PROFILE_UPDATE',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
};
let UserActivityService = class UserActivityService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async recordLogin(userId, req) {
        const { ipAddress, userAgent, location } = this.extractClientContext(req);
        const deviceInfo = this.resolveDevice(userId, userAgent);
        const { deviceId, isNew } = await this.ensureDevice(userId, {
            fingerprint: deviceInfo.fingerprint,
            displayName: deviceInfo.displayName,
            userAgent,
            ipAddress,
            location,
            deviceType: deviceInfo.deviceType,
        });
        const metadata = this.normalizeMetadata({
            device: deviceInfo.displayName,
            browser: deviceInfo.browser,
            platform: deviceInfo.platform,
            ipAddress,
            location,
        });
        await this.logActivity({
            userId,
            type: Activity.LOGIN,
            description: 'Signed in successfully.',
            metadata,
            ipAddress,
            userAgent,
            deviceFingerprint: deviceInfo.fingerprint,
            deviceName: deviceInfo.displayName,
            location,
            performedAt: new Date(),
            deviceType: deviceInfo.deviceType,
        });
        if (isNew) {
            await this.logActivity({
                userId,
                type: Activity.DEVICE_SIGN_IN,
                description: 'New device detected for this account.',
                metadata,
                ipAddress,
                userAgent,
                deviceFingerprint: deviceInfo.fingerprint,
                deviceName: deviceInfo.displayName,
                location,
                performedAt: new Date(),
                deviceType: deviceInfo.deviceType,
            });
        }
        if (deviceId) {
            await this.prisma.userActivity.updateMany({
                where: {
                    userId,
                    deviceId: null,
                    device: null,
                    type: { in: [Activity.LOGIN, Activity.DEVICE_SIGN_IN] },
                },
                data: { deviceId },
            });
        }
    }
    async recordProfileUpdate(userId, updatedFields, req) {
        if (!updatedFields.length)
            return;
        const context = req
            ? this.extractClientContext(req)
            : { ipAddress: null, userAgent: null, location: null };
        await this.logActivity({
            userId,
            type: Activity.PROFILE_UPDATE,
            description: 'Profile information updated.',
            metadata: this.normalizeMetadata({
                fields: updatedFields.join(', '),
                ipAddress: context.ipAddress ?? null,
            }),
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null,
            location: context.location ?? null,
        });
    }
    async recordPasswordChange(userId, method, req) {
        const { ipAddress, userAgent, location } = this.extractClientContext(req);
        await this.logActivity({
            userId,
            type: Activity.PASSWORD_CHANGE,
            description: 'Password updated successfully.',
            metadata: this.normalizeMetadata({
                method,
                ipAddress,
                location,
            }),
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            location: location ?? null,
        });
    }
    async logActivity(input) {
        const metadata = this.normalizeMetadata((input.metadata ?? undefined));
        const deviceResult = input.deviceFingerprint && input.deviceName
            ? await this.ensureDevice(input.userId, {
                fingerprint: input.deviceFingerprint,
                displayName: input.deviceName,
                userAgent: input.userAgent ?? null,
                ipAddress: input.ipAddress ?? null,
                location: input.location ?? null,
                deviceType: input.deviceType ?? 'Desktop',
            })
            : { deviceId: null, isNew: false };
        await this.prisma.userActivity.create({
            data: {
                userId: input.userId,
                type: input.type,
                description: input.description ?? null,
                metadata,
                ipAddress: input.ipAddress ?? null,
                userAgent: input.userAgent ?? null,
                performedAt: input.performedAt ?? new Date(),
                deviceId: deviceResult.deviceId ?? undefined,
            },
        });
    }
    async ensureDevice(userId, input) {
        if (!input.fingerprint) {
            return { deviceId: null, isNew: false };
        }
        const now = new Date();
        const existing = await this.prisma.userDevice.findUnique({
            where: { fingerprint: input.fingerprint },
        });
        if (existing) {
            const updated = await this.prisma.userDevice.update({
                where: { id: existing.id },
                data: {
                    displayName: input.displayName ?? existing.displayName,
                    userAgent: input.userAgent ?? existing.userAgent,
                    lastIpAddress: input.ipAddress ?? existing.lastIpAddress,
                    location: input.location ?? existing.location,
                    lastSeenAt: now,
                    deviceType: input.deviceType ?? existing.deviceType ?? 'Desktop',
                },
            });
            return { deviceId: updated.id, isNew: false };
        }
        const created = await this.prisma.userDevice.create({
            data: {
                userId,
                fingerprint: input.fingerprint,
                displayName: input.displayName,
                userAgent: input.userAgent,
                lastIpAddress: input.ipAddress,
                location: input.location,
                firstSeenAt: now,
                lastSeenAt: now,
                deviceType: input.deviceType,
            },
        });
        return { deviceId: created.id, isNew: true };
    }
    extractClientContext(req) {
        const forwarded = this.getHeader(req, 'x-forwarded-for');
        const xReal = this.getHeader(req, 'x-real-ip');
        const ipHeader = forwarded || xReal;
        const ipAddress = ipHeader ? ipHeader.split(',')[0].trim() : (req.ip || null);
        const userAgent = this.getHeader(req, 'user-agent') || null;
        const location = this.getHeader(req, 'x-app-location') || null;
        return { ipAddress, userAgent, location };
    }
    getHeader(req, key) {
        const headers = req.headers;
        const value = headers[key] ?? headers[key.toLowerCase()];
        if (Array.isArray(value)) {
            return value[0];
        }
        return typeof value === 'string' ? value : undefined;
    }
    resolveDevice(userId, userAgent) {
        if (!userAgent) {
            return {
                fingerprint: this.computeFingerprint(userId, 'unknown'),
                displayName: 'Unknown device',
                browser: 'Unknown',
                platform: 'Unknown',
                deviceType: 'Desktop',
            };
        }
        const ua = userAgent.toLowerCase();
        let browser = null;
        if (ua.includes('edg/'))
            browser = 'Edge';
        else if (ua.includes('chrome'))
            browser = 'Chrome';
        else if (ua.includes('safari'))
            browser = 'Safari';
        else if (ua.includes('firefox'))
            browser = 'Firefox';
        else if (ua.includes('msie') || ua.includes('trident'))
            browser = 'Internet Explorer';
        let platform = null;
        let deviceType = 'Desktop';
        if (ua.includes('iphone') || (ua.includes('android') && ua.includes('mobile'))) {
            platform = 'iOS / Android';
            deviceType = 'Mobile';
        }
        else if (ua.includes('ipad') || ua.includes('tablet')) {
            platform = 'Tablet';
            deviceType = 'Tablet';
        }
        else if (ua.includes('mac os')) {
            platform = 'macOS';
        }
        else if (ua.includes('windows')) {
            platform = 'Windows';
        }
        else if (ua.includes('linux')) {
            platform = 'Linux';
        }
        const displayNameParts = [];
        if (browser)
            displayNameParts.push(browser);
        if (platform)
            displayNameParts.push(`on ${platform}`);
        const displayName = displayNameParts.length ? displayNameParts.join(' ') : 'Unknown device';
        return {
            fingerprint: this.computeFingerprint(userId, userAgent),
            displayName,
            browser,
            platform,
            deviceType,
        };
    }
    computeFingerprint(userId, userAgent) {
        if (!userAgent) {
            return null;
        }
        return (0, crypto_1.createHash)('sha256').update(`${userId}:${userAgent}`).digest('hex');
    }
    normalizeMetadata(metadata) {
        if (!metadata)
            return undefined;
        const entries = Object.entries(metadata).filter(([, value]) => {
            if (value === undefined || value === null)
                return false;
            if (typeof value === 'string')
                return value.trim().length > 0;
            return true;
        });
        if (!entries.length)
            return undefined;
        return Object.fromEntries(entries);
    }
};
exports.UserActivityService = UserActivityService;
exports.UserActivityService = UserActivityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserActivityService);
//# sourceMappingURL=user-activity.service.js.map