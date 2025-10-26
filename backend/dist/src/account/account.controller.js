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
exports.AccountController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const avatar_1 = require("../common/uploads/avatar");
const multipart_1 = require("../common/uploads/multipart");
const user_activity_service_1 = require("../user-activity/user-activity.service");
const bcrypt = require("bcrypt");
const assert_strong_password_1 = require("../common/validation/assert-strong-password");
const image_utils_1 = require("../common/images/image.utils");
const normalizeNullableString = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};
const normalizeRequiredString = (value, field) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        throw new common_1.BadRequestException({
            message: 'validation.fieldInvalid',
            errors: [{ field, key: 'validation.fieldRequired' }],
        });
    }
    return trimmed;
};
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
const HALF_DAY_IN_MS = 12 * 60 * 60 * 1000;
let AccountController = class AccountController {
    prisma;
    userActivity;
    activityPageSize = 2;
    companySingletonKey = 'default';
    defaultCompanyProfile = {
        legalName: 'Sistema Administrativo, Inc.',
        tradeName: 'Sistema Administrativo',
        taxId: 'RUC 1234567890',
        email: 'facturacion@sistemadministrativo.com',
        phone: '(123) 456-7890',
        website: 'www.sistemadministrativo.com',
        addressLine1: '9498 Harvard Street',
        addressLine2: 'Fairfield, Chicago Town 06824',
        logo: null,
    };
    constructor(prisma, userActivity) {
        this.prisma = prisma;
        this.userActivity = userActivity;
    }
    extractUserId(req) {
        const authUser = req.user;
        const userId = Number(authUser?.sub);
        if (!Number.isInteger(userId)) {
            throw new common_1.BadRequestException('account.activity.userNotFound');
        }
        return userId;
    }
    startOfDay(date) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    dateKey(date) {
        return this.startOfDay(date).toISOString().slice(0, 10);
    }
    formatActivityType(type) {
        return type.replace(/_/g, '-');
    }
    mapCompanyProfile(profile) {
        if (!profile) {
            return { ...this.defaultCompanyProfile };
        }
        const logoBuffer = (0, image_utils_1.ensureNodeBuffer)(profile.logo);
        return {
            legalName: profile.legalName || this.defaultCompanyProfile.legalName,
            tradeName: profile.tradeName || this.defaultCompanyProfile.tradeName,
            taxId: profile.taxId ?? null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
            website: profile.website ?? null,
            addressLine1: profile.addressLine1 ?? null,
            addressLine2: profile.addressLine2 ?? null,
            logo: logoBuffer ? (0, image_utils_1.buildImageDataUrl)(logoBuffer) : null,
        };
    }
    normalizeFilterTypes(filter) {
        if (!Array.isArray(filter) || filter.length === 0) {
            return null;
        }
        const allowed = new Set(Object.values(client_1.UserActivityType));
        const normalized = filter
            .map((value) => (value || '').toUpperCase().replace(/-/g, '_'))
            .filter((value) => allowed.has(value));
        return normalized.length ? normalized : null;
    }
    normalizeMetadataResponse(activity) {
        const record = {};
        if (activity.metadata &&
            typeof activity.metadata === 'object' &&
            !Array.isArray(activity.metadata)) {
            for (const [key, value] of Object.entries(activity.metadata)) {
                if (value === undefined || value === null)
                    continue;
                const stringValue = typeof value === 'string' ? value : String(value);
                if (stringValue.trim().length > 0) {
                    record[key] = stringValue;
                }
            }
        }
        if (activity.ipAddress && !record.ipAddress) {
            record.ipAddress = activity.ipAddress;
        }
        if (activity.device?.displayName && !record.device) {
            record.device = activity.device.displayName;
        }
        if (activity.device?.location && !record.location) {
            record.location = activity.device.location;
        }
        return Object.keys(record).length ? record : undefined;
    }
    resolveUserName(user) {
        if (!user)
            return 'User';
        const firstName = normalizeNullableString(user.name);
        const lastName = normalizeNullableString(user.lastName);
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        const email = normalizeNullableString(user.email);
        return fullName || email || 'User';
    }
    resolveDeviceType(deviceType) {
        switch (deviceType) {
            case 'Mobile':
                return 'Mobile';
            case 'Tablet':
                return 'Tablet';
            default:
                return 'Desktop';
        }
    }
    async buildLoginHistory(userId) {
        if (!Number.isInteger(userId)) {
            return [];
        }
        const devices = await this.prisma.userDevice.findMany({
            where: { userId },
            orderBy: { lastSeenAt: 'desc' },
            take: 10,
        });
        return devices.map((device) => ({
            type: this.resolveDeviceType(device.deviceType),
            deviceName: device.displayName || 'Unknown device',
            time: Math.floor((device.lastSeenAt ?? device.firstSeenAt).getTime() / 1000),
            location: device.location || 'Unknown',
        }));
    }
    buildActivityWhere(userId, types) {
        const clauses = [client_1.Prisma.sql `"userId" = ${userId}`];
        if (types?.length) {
            const enumValues = types.map((type) => client_1.Prisma.sql `${type}::"UserActivityType"`);
            clauses.push(client_1.Prisma.sql `"type" IN (${client_1.Prisma.join(enumValues)})`);
        }
        return client_1.Prisma.join(clauses, ' AND ');
    }
    buildActivityGroups(activities, req) {
        const map = new Map();
        for (const activity of activities) {
            const day = this.startOfDay(activity.performedAt);
            const key = this.dateKey(day);
            if (!map.has(key)) {
                const displayDate = new Date(day.getTime() + HALF_DAY_IN_MS);
                map.set(key, {
                    id: key,
                    date: Math.floor(displayDate.getTime() / 1000),
                    events: [],
                });
            }
            const container = map.get(key);
            const avatar = (0, avatar_1.resolveAvatarPublicUrl)(req, activity.user?.img ?? null) || '';
            container.events.push({
                type: this.formatActivityType(activity.type),
                dateTime: Math.floor(activity.performedAt.getTime() / 1000),
                userName: this.resolveUserName(activity.user ?? undefined),
                userImg: avatar || undefined,
                description: activity.description ?? undefined,
                metadata: this.normalizeMetadataResponse(activity),
            });
        }
        for (const group of map.values()) {
            group.events.sort((a, b) => b.dateTime - a.dateTime);
            if (group.events.length > 0) {
                group.date = group.events[0].dateTime;
            }
        }
        return map;
    }
    async setting(req) {
        const authUser = req.user;
        const userId = Number(authUser?.sub);
        const fallbackEmail = authUser?.email || 'admin@example.com';
        const fallbackFirstName = normalizeNullableString(authUser?.name) || 'Admin';
        const fallbackLastName = normalizeNullableString(authUser?.lastName) || '';
        let email = fallbackEmail;
        let firstName = fallbackFirstName;
        let lastName = fallbackLastName;
        let avatar = normalizeNullableString(authUser?.avatar) || '';
        let lang = normalizeLanguagePreference(authUser?.lang || null);
        if (Number.isInteger(userId)) {
            const dbUser = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, name: true, lastName: true, img: true, lang: true },
            });
            if (dbUser) {
                email = dbUser.email || fallbackEmail;
                firstName =
                    normalizeNullableString(dbUser.name) || fallbackFirstName || 'Admin';
                lastName =
                    normalizeNullableString(dbUser.lastName) || fallbackLastName || '';
                avatar = normalizeNullableString(dbUser.img) || avatar || '';
                lang = normalizeLanguagePreference(dbUser.lang);
            }
        }
        const name = [firstName, lastName].filter(Boolean).join(' ');
        const resolvedAvatar = (0, avatar_1.resolveAvatarPublicUrl)(req, avatar);
        const loginHistory = await this.buildLoginHistory(userId);
        return {
            profile: {
                email,
                firstName,
                name,
                lastName,
                avatar: resolvedAvatar || '/img/avatars/thumb-1.jpg',
                lang,
            },
            loginHistory,
        };
    }
    integration() {
        return { providers: [] };
    }
    billing() {
        return { plans: [] };
    }
    async invoice(id) {
        const normalizeString = (value) => {
            if (typeof value !== 'string') {
                return null;
            }
            const trimmed = value.trim();
            return trimmed.length ? trimmed : null;
        };
        const composeLine1 = (addr) => {
            if (!addr)
                return null;
            const street = normalizeString(addr.street);
            const number = normalizeString(addr.number);
            if (street && number) {
                return `${street} ${number}`;
            }
            return street ?? number;
        };
        const composeLine2 = (addr) => {
            if (!addr)
                return null;
            const apartment = normalizeString(addr.apartment);
            const corner = normalizeString(addr.corner);
            const parts = [apartment ? `Apt ${apartment}` : null, corner].filter((segment) => Boolean(segment));
            return parts.length ? parts.join(' • ') : null;
        };
        const buildAddressLines = ({ line1, line2, city, state, zip, fallback, }) => {
            const resolvedLine1 = normalizeString(line1) ?? composeLine1(fallback);
            const resolvedLine2 = normalizeString(line2) ?? composeLine2(fallback);
            const resolvedCity = normalizeString(city) ?? normalizeString(fallback?.city);
            const resolvedState = normalizeString(state) ?? normalizeString(fallback?.country);
            const resolvedZip = normalizeString(zip);
            const cityState = [resolvedCity, resolvedState]
                .filter((segment) => Boolean(segment))
                .join(', ');
            return [
                resolvedLine1,
                resolvedLine2,
                cityState.length ? cityState : null,
                resolvedZip,
            ].filter((segment) => Boolean(segment));
        };
        let resolvedAddress = [];
        const numericId = Number(id);
        if (Number.isInteger(numericId) && numericId > 0) {
            const order = await this.prisma.order.findUnique({
                where: { id: numericId },
                include: {
                    customer: {
                        include: {
                            addresses: {
                                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                            },
                        },
                    },
                },
            });
            if (order) {
                const addresses = order.customer?.addresses ?? [];
                const primaryAddress = addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null;
                const secondaryAddress = addresses.find((address) => !address.isPrimary && address.id !== primaryAddress?.id) ?? null;
                const billingLines = buildAddressLines({
                    line1: order.billingAddress1,
                    line2: order.billingAddress2,
                    city: order.billingCity,
                    state: order.billingState,
                    zip: order.billingZip,
                    fallback: secondaryAddress ?? primaryAddress,
                });
                const shippingLines = buildAddressLines({
                    line1: order.shippingAddress1,
                    line2: order.shippingAddress2,
                    city: order.shippingCity,
                    state: order.shippingState,
                    zip: order.shippingZip,
                    fallback: primaryAddress ?? secondaryAddress,
                });
                resolvedAddress =
                    billingLines.length > 0
                        ? billingLines
                        : shippingLines.length > 0
                            ? shippingLines
                            : [];
            }
        }
        const companyProfile = await this.prisma.companyProfile.findUnique({
            where: { singleton: this.companySingletonKey },
            select: {
                legalName: true,
                tradeName: true,
                taxId: true,
                email: true,
                phone: true,
                website: true,
                addressLine1: true,
                addressLine2: true,
                logo: true,
            },
        });
        return {
            id,
            address: resolvedAddress,
            items: [],
            company: this.mapCompanyProfile(companyProfile),
        };
    }
    async log(req, body) {
        const userId = this.extractUserId(req);
        const filters = this.normalizeFilterTypes(body?.filter);
        const pageIndex = Number(body?.activityIndex) || 1;
        const page = pageIndex > 0 ? pageIndex : 1;
        const offset = (page - 1) * this.activityPageSize;
        const whereClause = this.buildActivityWhere(userId, filters);
        const rawDates = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT DISTINCT DATE("performedAt") AS "date"
        FROM "UserActivity"
        WHERE ${whereClause}
        ORDER BY "date" DESC
        OFFSET ${offset}
        LIMIT ${this.activityPageSize + 1}
      `);
        const pageDates = rawDates
            .slice(0, this.activityPageSize)
            .map((row) => new Date(row.date));
        const loadable = rawDates.length > this.activityPageSize;
        if (!pageDates.length) {
            return {
                data: [],
                loadable: false,
            };
        }
        const dayRanges = pageDates.map((date) => {
            const start = this.startOfDay(date);
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            return { start, end };
        });
        const rangeStart = dayRanges.reduce((acc, range) => (range.start < acc ? range.start : acc), dayRanges[0].start);
        const rangeEnd = dayRanges.reduce((acc, range) => (range.end > acc ? range.end : acc), dayRanges[0].end);
        const activities = await this.prisma.userActivity.findMany({
            where: {
                userId,
                ...(filters ? { type: { in: filters } } : {}),
                performedAt: {
                    gte: rangeStart,
                    lt: rangeEnd,
                },
            },
            include: {
                user: {
                    select: {
                        name: true,
                        lastName: true,
                        email: true,
                        img: true,
                    },
                },
                device: {
                    select: {
                        displayName: true,
                        location: true,
                    },
                },
            },
            orderBy: { performedAt: 'desc' },
        });
        const groups = this.buildActivityGroups(activities, req);
        const orderedKeys = pageDates.map((date) => this.dateKey(date));
        const data = orderedKeys
            .map((key) => groups.get(key))
            .filter((log) => Boolean(log));
        return {
            data,
            loadable,
        };
    }
    form() {
        return { kyc: {} };
    }
    async updatePassword(req, body) {
        const userId = this.extractUserId(req);
        const currentPassword = normalizeRequiredString(body?.password ?? '', 'password');
        const newPassword = normalizeRequiredString(body?.newPassword ?? '', 'newPassword');
        (0, assert_strong_password_1.assertStrongPassword)(newPassword, 'newPassword');
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('account.settings.profile.userNotFound');
        }
        const valid = await bcrypt.compare(currentPassword, existing.passwordHash);
        if (!valid) {
            throw new common_1.BadRequestException('account.settings.password.invalidCurrent');
        }
        const sameAsOld = await bcrypt.compare(newPassword, existing.passwordHash);
        if (sameAsOld) {
            throw new common_1.BadRequestException('account.settings.password.sameAsOld');
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashed },
        });
        await this.userActivity.recordPasswordChange(userId, 'Self-service', req);
        return { ok: true };
    }
    async updateProfile(req) {
        const authUser = req?.user;
        const userId = Number(authUser?.sub);
        if (!Number.isInteger(userId)) {
            throw new common_1.BadRequestException('account.settings.profile.userNotFound');
        }
        const { fields, file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        const firstName = normalizeRequiredString(fields.firstName ?? '', 'firstName');
        const lastName = normalizeNullableString(fields.lastName);
        const email = normalizeRequiredString(fields.email ?? '', 'email').toLowerCase();
        const lang = normalizeLanguagePreference(fields.lang);
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                img: true,
                name: true,
                lastName: true,
                email: true,
                role: true,
                lang: true,
            },
        });
        if (!existing) {
            throw new common_1.BadRequestException('account.settings.profile.userNotFound');
        }
        const currentAvatar = (0, avatar_1.normalizeAvatarPath)(existing.img);
        let avatarToPersist = currentAvatar;
        if (file) {
            avatarToPersist = await (0, avatar_1.persistAvatarFile)(file, currentAvatar);
        }
        try {
            const updated = await this.prisma.user.update({
                where: { id: userId },
                data: {
                    name: firstName,
                    lastName,
                    email,
                    img: avatarToPersist ?? null,
                    lang,
                },
                select: {
                    id: true,
                    name: true,
                    lastName: true,
                    email: true,
                    img: true,
                    role: true,
                    lang: true,
                },
            });
            const previousFirstName = normalizeNullableString(existing.name) || '';
            const previousLastName = normalizeNullableString(existing.lastName) || '';
            const previousEmail = (existing.email || '').toLowerCase();
            const previousAvatar = currentAvatar;
            const previousLang = normalizeLanguagePreference(existing.lang);
            const updatedFields = [];
            if (previousFirstName !== firstName) {
                updatedFields.push('First name');
            }
            if (previousLastName !== (lastName || '')) {
                updatedFields.push('Last name');
            }
            if (previousEmail !== email) {
                updatedFields.push('Email');
            }
            if ((previousAvatar || null) !== (avatarToPersist || null)) {
                updatedFields.push('Avatar');
            }
            if (previousLang !== lang) {
                updatedFields.push('Language');
            }
            if (updatedFields.length) {
                await this.userActivity.recordProfileUpdate(userId, updatedFields, req);
            }
            const publicAvatar = (0, avatar_1.resolveAvatarPublicUrl)(req, updated.img);
            return {
                profile: {
                    firstName: updated.name || '',
                    lastName: updated.lastName || '',
                    name: [updated.name, updated.lastName].filter(Boolean).join(' ') ||
                        updated.name ||
                        '',
                    email: updated.email,
                    avatar: publicAvatar || '',
                    lang,
                },
                user: {
                    email: updated.email,
                    avatar: publicAvatar || '',
                    authority: [updated.role],
                    name: updated.name || '',
                    lastName: updated.lastName || '',
                    lang,
                },
            };
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.BadRequestException({
                    message: 'account.settings.profile.emailTaken',
                    errors: [{ field: 'email', key: 'account.settings.profile.emailTaken' }],
                });
            }
            throw error;
        }
    }
    async updateLanguage(req, body) {
        const authUser = req?.user;
        const userId = Number(authUser?.sub);
        if (!Number.isInteger(userId)) {
            throw new common_1.BadRequestException('account.settings.profile.userNotFound');
        }
        if (!body || typeof body.lang !== 'string') {
            throw new common_1.BadRequestException('validation.fieldInvalid');
        }
        const nextLang = normalizeLanguagePreference(body.lang);
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { lang: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('account.settings.profile.userNotFound');
        }
        const currentLang = normalizeLanguagePreference(existing.lang);
        if (currentLang === nextLang) {
            return { lang: currentLang };
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { lang: nextLang },
        });
        await this.userActivity.recordProfileUpdate(userId, ['Language'], req);
        return { lang: nextLang };
    }
};
exports.AccountController = AccountController;
__decorate([
    (0, common_1.Get)('setting'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountController.prototype, "setting", null);
__decorate([
    (0, common_1.Get)('setting/integration'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "integration", null);
__decorate([
    (0, common_1.Get)('setting/billing'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "billing", null);
__decorate([
    (0, common_1.Get)('invoice'),
    __param(0, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccountController.prototype, "invoice", null);
__decorate([
    (0, common_1.Post)('log'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AccountController.prototype, "log", null);
__decorate([
    (0, common_1.Get)('form'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "form", null);
__decorate([
    (0, common_1.Put)('setting/password'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AccountController.prototype, "updatePassword", null);
__decorate([
    (0, common_1.Put)('setting/profile'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Put)('setting/language'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AccountController.prototype, "updateLanguage", null);
exports.AccountController = AccountController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('account'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_activity_service_1.UserActivityService])
], AccountController);
//# sourceMappingURL=account.controller.js.map