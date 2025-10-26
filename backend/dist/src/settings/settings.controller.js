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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const currency_conversion_service_1 = require("../common/currency/currency-conversion.service");
const currency_constants_1 = require("../common/currency/currency.constants");
const image_utils_1 = require("../common/images/image.utils");
const multipart_1 = require("../common/uploads/multipart");
const shipping_1 = require("../common/uploads/shipping");
const sanitize_1 = require("../common/utils/sanitize");
let SettingsController = class SettingsController {
    prisma;
    currencyConversion;
    constructor(prisma, currencyConversion) {
        this.prisma = prisma;
        this.currencyConversion = currencyConversion;
    }
    companySingletonKey = 'default';
    disclaimerConfigKey = 'documentDisclaimerHtml';
    defaultCalendarEventTypes = [
        { name: 'Reunión', color: '#2563eb' },
        { name: 'Tarea', color: '#059669' },
        { name: 'Taller', color: '#7c3aed' },
        { name: 'Otro', color: '#6b7280' },
    ];
    defaultOrderStatuses = [
        { code: 0, name: 'Pagado', color: 'emerald-500' },
        { code: 1, name: 'Pendiente', color: 'amber-500' },
        { code: 2, name: 'Cancelado', color: 'red-500' },
    ];
    defaultThemeConfig = {
        themeColor: 'indigo',
        direction: 'ltr',
        mode: 'light',
        primaryColorLevel: 600,
        panelExpand: false,
        navMode: 'light',
        cardBordered: true,
        layout: {
            type: 'modern',
            sideNavCollapse: false,
        },
    };
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
    maxLogoSizeBytes = 512 * 1024;
    mapCompanyProfile(record) {
        if (!record) {
            return { ...this.defaultCompanyProfile };
        }
        const logoBuffer = (0, image_utils_1.ensureNodeBuffer)(record.logo);
        return {
            legalName: record.legalName,
            tradeName: record.tradeName,
            taxId: record.taxId ?? null,
            email: record.email ?? null,
            phone: record.phone ?? null,
            website: record.website ?? null,
            addressLine1: record.addressLine1 ?? null,
            addressLine2: record.addressLine2 ?? null,
            logo: logoBuffer ? (0, image_utils_1.buildImageDataUrl)(logoBuffer) : null,
        };
    }
    buildCompanyProfileData(body) {
        const legalName = this.sanitizeName(body.legalName);
        if (!legalName) {
            throw new common_1.BadRequestException('settings.companyProfile.legalNameRequired');
        }
        const tradeName = this.sanitizeName(body.tradeName);
        if (!tradeName) {
            throw new common_1.BadRequestException('settings.companyProfile.tradeNameRequired');
        }
        const optional = (value) => this.sanitizeName(value);
        return {
            legalName,
            tradeName,
            taxId: optional(body.taxId),
            email: optional(body.email),
            phone: optional(body.phone),
            website: optional(body.website),
            addressLine1: optional(body.addressLine1),
            addressLine2: optional(body.addressLine2),
        };
    }
    parseLogoInput(value) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        if (typeof value !== 'string') {
            throw new common_1.BadRequestException('settings.companyProfile.logoInvalid');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        let base64Payload = trimmed;
        if (trimmed.startsWith('data:')) {
            const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) {
                throw new common_1.BadRequestException('settings.companyProfile.logoInvalid');
            }
            base64Payload = match[2];
        }
        let buffer;
        try {
            buffer = Buffer.from(base64Payload, 'base64');
        }
        catch {
            throw new common_1.BadRequestException('settings.companyProfile.logoInvalid');
        }
        if (!buffer || buffer.length === 0) {
            throw new common_1.BadRequestException('settings.companyProfile.logoInvalid');
        }
        if (buffer.length > this.maxLogoSizeBytes) {
            throw new common_1.BadRequestException('settings.companyProfile.logoTooLarge');
        }
        const mimeType = (0, image_utils_1.detectImageMimeType)(buffer);
        if (!mimeType) {
            throw new common_1.BadRequestException('settings.companyProfile.logoUnsupported');
        }
        return buffer;
    }
    toPrismaBytes(buffer) {
        const bytes = new Uint8Array(buffer.length);
        bytes.set(buffer);
        return bytes;
    }
    prepareLogoForPersistence(logo) {
        if (logo === undefined) {
            return undefined;
        }
        if (logo === null) {
            return null;
        }
        return this.toPrismaBytes(logo);
    }
    sanitizeThemeConfig(payload) {
        const allowedDirections = ['ltr', 'rtl'];
        const allowedModes = ['light', 'dark'];
        const allowedNavModes = [
            'transparent',
            'light',
            'dark',
            'themed',
        ];
        const allowedLayouts = [
            'classic',
            'modern',
            'stackedSide',
            'simple',
            'decked',
            'blank',
        ];
        const allowedColorLevels = [400, 500, 600, 700, 800, 900];
        const next = {
            ...this.defaultThemeConfig,
            ...payload,
            layout: {
                ...this.defaultThemeConfig.layout,
                ...(payload.layout ?? {}),
            },
        };
        const trimmedColor = String(payload.themeColor ?? next.themeColor).trim();
        next.themeColor = trimmedColor || this.defaultThemeConfig.themeColor;
        if (!allowedDirections.includes(next.direction)) {
            next.direction = this.defaultThemeConfig.direction;
        }
        if (!allowedModes.includes(next.mode)) {
            next.mode = this.defaultThemeConfig.mode;
        }
        if (!allowedNavModes.includes(next.navMode)) {
            next.navMode = this.defaultThemeConfig.navMode;
        }
        const requestedLevel = Number(payload.primaryColorLevel ?? next.primaryColorLevel);
        next.primaryColorLevel = allowedColorLevels.includes(requestedLevel)
            ? requestedLevel
            : this.defaultThemeConfig.primaryColorLevel;
        if (!allowedLayouts.includes(next.layout.type)) {
            next.layout.type = this.defaultThemeConfig.layout.type;
        }
        if (payload.panelExpand !== undefined) {
            next.panelExpand = Boolean(payload.panelExpand);
        }
        if (payload.cardBordered !== undefined) {
            next.cardBordered = Boolean(payload.cardBordered);
        }
        if (payload.layout?.sideNavCollapse !== undefined) {
            next.layout.sideNavCollapse = Boolean(payload.layout.sideNavCollapse);
        }
        return next;
    }
    parseNumber(value, fallback) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }
    parseInteger(value, fallback) {
        const num = this.parseNumber(value, fallback);
        return Math.round(num);
    }
    normalizeColor(value) {
        if (!value) {
            return '#2563eb';
        }
        const trimmed = value.trim();
        const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
        if (hexPattern.test(trimmed)) {
            return trimmed.length === 4
                ? '#' + trimmed.substring(1).split('').map((c) => c + c).join('').toLowerCase()
                : trimmed.toLowerCase();
        }
        return trimmed;
    }
    normalizeOptionalColor(value) {
        if (value === null || value === undefined) {
            return null;
        }
        const trimmed = String(value).trim();
        if (!trimmed) {
            return null;
        }
        return this.normalizeColor(trimmed);
    }
    sanitizeName(value) {
        const name = String(value ?? '').trim();
        return name.length ? name : null;
    }
    parseOptionalNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
    parseOptionalInteger(value) {
        const num = this.parseOptionalNumber(value);
        return num === null ? null : Math.round(num);
    }
    async ensureCalendarEventTypesSeeded() {
        const count = await this.prisma.calendarEventType.count();
        if (count === 0) {
            await this.prisma.calendarEventType.createMany({
                data: this.defaultCalendarEventTypes.map((item) => ({
                    name: item.name,
                    color: this.normalizeColor(item.color),
                })),
                skipDuplicates: true,
            });
        }
    }
    async ensureOrderStatusesSeeded() {
        await this.prisma.$transaction(async (tx) => {
            const existing = await tx.orderStatus.count();
            if (existing > 0) {
                return;
            }
            await tx.orderStatus.createMany({
                data: this.defaultOrderStatuses.map((status, index) => ({
                    name: status.name,
                    color: this.normalizeOptionalColor(status.color),
                    code: status.code !== undefined && status.code !== null
                        ? this.parseInteger(status.code, index)
                        : index,
                })),
                skipDuplicates: true,
            });
        });
    }
    async getCompanyProfile() {
        const profile = await this.prisma.companyProfile.findUnique({
            where: { singleton: this.companySingletonKey },
        });
        return this.mapCompanyProfile(profile);
    }
    async updateCompanyProfile(body) {
        const data = this.buildCompanyProfileData(body);
        const logoBuffer = this.parseLogoInput(body.logo);
        const updateData = {
            ...data,
            ...(logoBuffer !== undefined
                ? { logo: this.prepareLogoForPersistence(logoBuffer) }
                : {}),
        };
        const createData = {
            singleton: this.companySingletonKey,
            ...data,
            ...(logoBuffer !== undefined
                ? { logo: this.prepareLogoForPersistence(logoBuffer) }
                : {}),
        };
        const updated = await this.prisma.companyProfile.upsert({
            where: { singleton: this.companySingletonKey },
            update: updateData,
            create: createData,
        });
        return this.mapCompanyProfile(updated);
    }
    async getOrderStatuses() {
        await this.ensureOrderStatusesSeeded();
        return this.prisma.orderStatus.findMany({ orderBy: { id: 'asc' } });
    }
    async createOrderStatus(body) {
        const nextCode = (await this.prisma.orderStatus.count());
        await this.prisma.orderStatus.create({ data: { name: body.name, code: nextCode, color: body.color } });
        return true;
    }
    async updateOrderStatus(body) {
        await this.prisma.orderStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } });
        return true;
    }
    async deleteOrderStatus(body) {
        await this.prisma.orderStatus.delete({ where: { id: body.id } });
        return true;
    }
    getCustomerStatuses() {
        return this.prisma.customerStatus.findMany({ orderBy: { id: 'asc' } });
    }
    async createCustomerStatus(body) {
        await this.prisma.customerStatus.create({ data: { name: body.name, color: body.color } });
        return true;
    }
    async updateCustomerStatus(body) {
        const id = Number(body.id);
        if (!Number.isFinite(id)) {
            throw new common_1.BadRequestException('Invalid status id');
        }
        const data = {};
        if (body.name !== undefined) {
            data.name = body.name;
        }
        if (body.color !== undefined) {
            data.color = body.color;
        }
        try {
            await this.prisma.customerStatus.update({ where: { id }, data });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new common_1.BadRequestException('Customer status not found');
            }
            throw error;
        }
        return true;
    }
    async deleteCustomerStatus(body) {
        await this.prisma.customerStatus.delete({ where: { id: body.id } });
        return true;
    }
    getExpenseStatuses() {
        return this.prisma.expenseStatus.findMany({ orderBy: { id: 'asc' } });
    }
    async createExpenseStatus(body) {
        await this.prisma.expenseStatus.create({ data: { name: body.name, color: body.color } });
        return true;
    }
    async updateExpenseStatus(body) {
        await this.prisma.expenseStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } });
        return true;
    }
    async deleteExpenseStatus(body) {
        await this.prisma.expenseStatus.delete({ where: { id: body.id } });
        return true;
    }
    getProductCategories() {
        return this.prisma.productCategory.findMany({ orderBy: { id: 'asc' } });
    }
    async createProductCategory(body) {
        await this.prisma.productCategory.create({ data: { name: body.name } });
        return true;
    }
    async updateProductCategory(body) {
        await this.prisma.productCategory.update({ where: { id: body.id }, data: { name: body.name } });
        return true;
    }
    async deleteProductCategory(body) {
        await this.prisma.productCategory.delete({ where: { id: body.id } });
        return true;
    }
    getPaymentMethods() {
        return this.prisma.paymentMethod.findMany({ orderBy: { id: 'asc' } });
    }
    async createPaymentMethod(body) {
        await this.prisma.paymentMethod.create({ data: { name: body.name } });
        return true;
    }
    async updatePaymentMethod(body) {
        await this.prisma.paymentMethod.update({ where: { id: body.id }, data: { name: body.name } });
        return true;
    }
    async deletePaymentMethod(body) {
        await this.prisma.paymentMethod.delete({ where: { id: body.id } });
        return true;
    }
    getShippingOptions() {
        return this.prisma.shippingOption.findMany({ orderBy: { id: 'asc' } });
    }
    async createShippingOption(req) {
        const { fields, file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        const name = String(fields.name ?? '').trim();
        if (!name) {
            throw new common_1.BadRequestException('Name is required');
        }
        const deliveryFees = this.parseNumber(fields.deliveryFees, 0);
        const estimatedMin = this.parseInteger(fields.estimatedMin, 0);
        const estimatedMax = this.parseInteger(fields.estimatedMax, estimatedMin);
        let img = (0, shipping_1.normalizeShippingLogoPath)(fields.img);
        if (file) {
            img = await (0, shipping_1.persistShippingLogo)(file);
        }
        await this.prisma.shippingOption.create({
            data: {
                name,
                deliveryFees,
                estimatedMin,
                estimatedMax,
                img: img ?? undefined,
            },
        });
        return true;
    }
    async updateShippingOption(req) {
        const { fields, file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        const id = Number(fields.id);
        if (!Number.isFinite(id)) {
            throw new common_1.BadRequestException('Invalid shipping option id');
        }
        const existing = await this.prisma.shippingOption.findUnique({
            where: { id },
            select: { img: true, estimatedMin: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('Invalid shipping option id');
        }
        const data = {};
        if (fields.name !== undefined) {
            const name = String(fields.name ?? '').trim();
            if (!name) {
                throw new common_1.BadRequestException('Name is required');
            }
            data.name = name;
        }
        if (fields.deliveryFees !== undefined) {
            data.deliveryFees = this.parseNumber(fields.deliveryFees, 0);
        }
        let estimatedMinUpdate;
        if (fields.estimatedMin !== undefined) {
            estimatedMinUpdate = this.parseInteger(fields.estimatedMin, 0);
            data.estimatedMin = estimatedMinUpdate;
        }
        if (fields.estimatedMax !== undefined) {
            const fallback = typeof estimatedMinUpdate === 'number'
                ? estimatedMinUpdate
                : existing.estimatedMin ?? 0;
            data.estimatedMax = this.parseInteger(fields.estimatedMax, fallback);
        }
        if (file) {
            data.img = await (0, shipping_1.persistShippingLogo)(file, existing.img);
        }
        else if (fields.img !== undefined) {
            data.img = (0, shipping_1.normalizeShippingLogoPath)(fields.img) ?? null;
        }
        await this.prisma.shippingOption.update({ where: { id }, data });
        return true;
    }
    async deleteShippingOption(body) {
        const id = Number(body.id);
        if (!Number.isFinite(id)) {
            throw new common_1.BadRequestException('Invalid shipping option id');
        }
        const existing = await this.prisma.shippingOption.findUnique({
            where: { id },
            select: { img: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('Invalid shipping option id');
        }
        await this.prisma.shippingOption.delete({ where: { id } });
        await (0, shipping_1.deleteShippingLogo)(existing.img);
        return true;
    }
    async exportConfigurations() {
        const [orderStatuses, customerStatuses, expenseStatuses, expenseCategories, productCategories, paymentMethods, shippingOptions, calendarEventTypes, systemConfigs, companyProfile,] = await Promise.all([
            this.prisma.orderStatus.findMany({ orderBy: { code: 'asc' } }),
            this.prisma.customerStatus.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.expenseStatus.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.expenseCategory.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.productCategory.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.paymentMethod.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.shippingOption.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.calendarEventType.findMany({ orderBy: { id: 'asc' } }),
            this.prisma.systemConfig.findMany(),
            this.prisma.companyProfile.findUnique({
                where: { singleton: this.companySingletonKey },
            }),
        ]);
        const systemConfigMap = new Map(systemConfigs.map((cfg) => [cfg.key, cfg.value]));
        const taxRateRaw = systemConfigMap.get('taxRate');
        const parsedTaxRate = Number(taxRateRaw ?? '22');
        const taxRate = Number.isFinite(parsedTaxRate) ? parsedTaxRate : 22;
        let themeConfig = this.defaultThemeConfig;
        const themeConfigRaw = systemConfigMap.get('themeConfig');
        if (themeConfigRaw) {
            try {
                const parsed = JSON.parse(themeConfigRaw);
                themeConfig = this.sanitizeThemeConfig(parsed);
            }
            catch {
                themeConfig = this.defaultThemeConfig;
            }
        }
        let currencies = ['USD', 'UYU'];
        const currenciesRaw = systemConfigMap.get('currencies');
        if (currenciesRaw) {
            try {
                const parsed = JSON.parse(currenciesRaw);
                if (Array.isArray(parsed)) {
                    const normalized = parsed
                        .map((item) => this.currencyConversion.normalizeCurrency(item))
                        .filter((item) => Boolean(item));
                    if (normalized.length) {
                        currencies = normalized;
                    }
                }
            }
            catch {
            }
        }
        const currencyBase = await this.currencyConversion.getBaseCurrency();
        const exchangeRateRecords = await this.currencyConversion.listRates(currencyBase);
        const exchangeRates = exchangeRateRecords.map((rate) => ({
            quote: rate.quote,
            rate: rate.rate.toString(),
            updatedAt: rate.updatedAt ?? null,
        }));
        exchangeRates.unshift({ quote: currencyBase, rate: '1', updatedAt: null });
        return {
            meta: { exportedAt: new Date().toISOString(), version: 1 },
            orderStatuses: orderStatuses.map(({ name, color, code }) => ({
                name,
                color,
                code,
            })),
            customerStatuses: customerStatuses.map(({ name, color }) => ({
                name,
                color,
            })),
            expenseStatuses: expenseStatuses.map(({ name, color }) => ({
                name,
                color,
            })),
            expenseCategories: expenseCategories.map(({ name }) => ({ name })),
            productCategories: productCategories.map(({ name }) => ({ name })),
            paymentMethods: paymentMethods.map(({ name }) => ({ name })),
            shippingOptions: shippingOptions.map(({ name, deliveryFees, estimatedMin, estimatedMax, img }) => ({
                name,
                deliveryFees,
                estimatedMin,
                estimatedMax,
                img,
            })),
            calendarEventTypes: calendarEventTypes.map(({ name, color, description }) => ({
                name,
                color,
                description,
            })),
            systemConfig: {
                taxRate,
                currencies,
                currencyBase,
                exchangeRates,
                themeConfig,
            },
            companyProfile: this.mapCompanyProfile(companyProfile),
        };
    }
    async importConfigurations(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new common_1.BadRequestException('Invalid payload');
        }
        const readArray = (value, field) => {
            if (value === null || value === undefined) {
                return [];
            }
            if (!Array.isArray(value)) {
                throw new common_1.BadRequestException(`${field} must be an array`);
            }
            return value;
        };
        const collectNamedItems = (source, builder) => {
            const map = new Map();
            for (const entry of source) {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                    continue;
                }
                const raw = entry;
                const name = this.sanitizeName(raw['name']);
                if (!name || map.has(name)) {
                    continue;
                }
                const result = builder(raw, name);
                if (result) {
                    map.set(name, result);
                }
            }
            return Array.from(map.values());
        };
        const hasOrderStatuses = Object.prototype.hasOwnProperty.call(payload, 'orderStatuses');
        const hasCustomerStatuses = Object.prototype.hasOwnProperty.call(payload, 'customerStatuses');
        const hasExpenseStatuses = Object.prototype.hasOwnProperty.call(payload, 'expenseStatuses');
        const hasExpenseCategories = Object.prototype.hasOwnProperty.call(payload, 'expenseCategories');
        const hasProductCategories = Object.prototype.hasOwnProperty.call(payload, 'productCategories');
        const hasPaymentMethods = Object.prototype.hasOwnProperty.call(payload, 'paymentMethods');
        const hasShippingOptions = Object.prototype.hasOwnProperty.call(payload, 'shippingOptions');
        const hasCalendarEventTypes = Object.prototype.hasOwnProperty.call(payload, 'calendarEventTypes');
        const hasSystemConfig = Object.prototype.hasOwnProperty.call(payload, 'systemConfig');
        const hasCompanyProfile = Object.prototype.hasOwnProperty.call(payload, 'companyProfile');
        if (hasOrderStatuses &&
            payload.orderStatuses !== undefined &&
            payload.orderStatuses !== null &&
            !Array.isArray(payload.orderStatuses)) {
            throw new common_1.BadRequestException('orderStatuses must be an array');
        }
        const sanitizedOrderStatuses = [];
        if (hasOrderStatuses) {
            const items = Array.isArray(payload.orderStatuses) ? payload.orderStatuses : [];
            const usedCodes = new Set();
            let nextCode = 0;
            for (const entry of items) {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                    continue;
                }
                const raw = entry;
                const name = this.sanitizeName(raw['name']);
                if (!name) {
                    continue;
                }
                let code = this.parseOptionalInteger(raw['code']);
                if (code !== null && code < 0) {
                    code = null;
                }
                if (code === null) {
                    while (usedCodes.has(nextCode)) {
                        nextCode += 1;
                    }
                    code = nextCode;
                    nextCode += 1;
                }
                else {
                    while (usedCodes.has(code)) {
                        code += 1;
                    }
                    nextCode = code + 1;
                }
                usedCodes.add(code);
                sanitizedOrderStatuses.push({
                    name,
                    code,
                    color: this.normalizeOptionalColor(raw['color']),
                });
            }
        }
        const sanitizedCustomerStatuses = hasCustomerStatuses
            ? collectNamedItems(readArray(payload.customerStatuses, 'customerStatuses'), (raw, name) => ({
                name,
                color: this.normalizeOptionalColor(raw['color']),
            }))
            : [];
        const sanitizedExpenseStatuses = hasExpenseStatuses
            ? collectNamedItems(readArray(payload.expenseStatuses, 'expenseStatuses'), (raw, name) => ({
                name,
                color: this.normalizeOptionalColor(raw['color']),
            }))
            : [];
        const sanitizedExpenseCategories = hasExpenseCategories
            ? collectNamedItems(readArray(payload.expenseCategories, 'expenseCategories'), (_, name) => ({ name }))
            : [];
        const sanitizedProductCategories = hasProductCategories
            ? collectNamedItems(readArray(payload.productCategories, 'productCategories'), (_, name) => ({ name }))
            : [];
        const sanitizedPaymentMethods = hasPaymentMethods
            ? collectNamedItems(readArray(payload.paymentMethods, 'paymentMethods'), (_, name) => ({ name }))
            : [];
        const sanitizedShippingOptions = hasShippingOptions
            ? collectNamedItems(readArray(payload.shippingOptions, 'shippingOptions'), (raw, name) => {
                const deliveryFees = this.parseOptionalNumber(raw['deliveryFees']);
                let estimatedMin = this.parseOptionalInteger(raw['estimatedMin']);
                if (estimatedMin !== null && estimatedMin < 0) {
                    estimatedMin = 0;
                }
                let estimatedMax = this.parseOptionalInteger(raw['estimatedMax']);
                if (estimatedMax !== null && estimatedMin !== null && estimatedMax < estimatedMin) {
                    estimatedMax = estimatedMin;
                }
                if (estimatedMax === null && estimatedMin !== null) {
                    estimatedMax = estimatedMin;
                }
                const imgRaw = raw['img'];
                let img = null;
                if (imgRaw !== null && imgRaw !== undefined) {
                    const trimmed = String(imgRaw).trim();
                    if (trimmed) {
                        img = trimmed;
                    }
                }
                return {
                    name,
                    deliveryFees,
                    estimatedMin,
                    estimatedMax,
                    img,
                };
            })
            : [];
        const sanitizedCalendarEventTypes = hasCalendarEventTypes
            ? collectNamedItems(readArray(payload.calendarEventTypes, 'calendarEventTypes'), (raw, name) => {
                const color = this.normalizeOptionalColor(raw['color']) ?? '#2563eb';
                const descriptionRaw = raw['description'];
                let description = null;
                if (descriptionRaw !== null && descriptionRaw !== undefined) {
                    const trimmed = String(descriptionRaw).trim();
                    if (trimmed) {
                        description = trimmed;
                    }
                }
                return {
                    name,
                    color,
                    description,
                };
            })
            : [];
        if (hasCalendarEventTypes && sanitizedCalendarEventTypes.length === 0) {
            sanitizedCalendarEventTypes.push(...this.defaultCalendarEventTypes.map((item) => ({
                name: item.name,
                color: this.normalizeColor(item.color),
                description: null,
            })));
        }
        let companyProfileData = null;
        let companyProfileLogo = undefined;
        if (hasCompanyProfile) {
            const rawProfile = payload.companyProfile;
            if (!rawProfile ||
                typeof rawProfile !== 'object' ||
                Array.isArray(rawProfile)) {
                throw new common_1.BadRequestException('companyProfile must be an object');
            }
            companyProfileData = this.buildCompanyProfileData(rawProfile);
            companyProfileLogo = this.parseLogoInput(rawProfile.logo);
        }
        const systemConfigUpdates = {};
        if (hasSystemConfig) {
            const rawConfig = payload.systemConfig;
            if (rawConfig !== null &&
                (typeof rawConfig !== 'object' || Array.isArray(rawConfig))) {
                throw new common_1.BadRequestException('systemConfig must be an object');
            }
            if (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) {
                const config = rawConfig;
                if (Object.prototype.hasOwnProperty.call(config, 'taxRate')) {
                    const taxRateValue = this.parseOptionalNumber(config['taxRate']);
                    if (taxRateValue === null) {
                        throw new common_1.BadRequestException('taxRate must be a valid number');
                    }
                    systemConfigUpdates.taxRate = taxRateValue;
                }
                if (Object.prototype.hasOwnProperty.call(config, 'currencies')) {
                    const currenciesValue = config['currencies'];
                    if (!Array.isArray(currenciesValue) || !currenciesValue.length) {
                        throw new common_1.BadRequestException('systemConfig.currencies must be a non-empty array');
                    }
                    const currencyArray = currenciesValue;
                    const normalizedCurrencies = currencyArray
                        .map((code) => this.currencyConversion.normalizeCurrency(code))
                        .filter((code) => Boolean(code));
                    if (!normalizedCurrencies.length) {
                        throw new common_1.BadRequestException('systemConfig.currencies must include at least one valid code');
                    }
                    systemConfigUpdates.currencies = normalizedCurrencies;
                }
                if (Object.prototype.hasOwnProperty.call(config, 'currencyBase')) {
                    const base = this.currencyConversion.normalizeCurrency(config['currencyBase']);
                    if (!base) {
                        throw new common_1.BadRequestException('currencyBase must be a valid currency code');
                    }
                    systemConfigUpdates.currencyBase = base;
                }
                if (Object.prototype.hasOwnProperty.call(config, 'exchangeRates')) {
                    const ratesValue = config['exchangeRates'];
                    if (ratesValue !== undefined && ratesValue !== null) {
                        if (!Array.isArray(ratesValue)) {
                            throw new common_1.BadRequestException('exchangeRates must be an array of rate objects');
                        }
                        const normalizedRates = ratesValue
                            .map((entry) => {
                            if (!entry || typeof entry !== 'object')
                                return null;
                            const rateEntry = entry;
                            const quote = this.currencyConversion.normalizeCurrency(rateEntry.quote);
                            const rateNumber = Number(rateEntry.rate);
                            if (!quote || !Number.isFinite(rateNumber) || rateNumber <= 0) {
                                return null;
                            }
                            return { quote, rate: rateNumber };
                        })
                            .filter((entry) => Boolean(entry));
                        systemConfigUpdates.exchangeRates = normalizedRates;
                    }
                }
                if (Object.prototype.hasOwnProperty.call(config, 'themeConfig')) {
                    const themeValue = config['themeConfig'];
                    if (!themeValue || typeof themeValue !== 'object' || Array.isArray(themeValue)) {
                        throw new common_1.BadRequestException('themeConfig must be an object');
                    }
                    systemConfigUpdates.themeConfig = this.sanitizeThemeConfig(themeValue);
                }
            }
        }
        const summary = {};
        let resolvedBaseForRates;
        if (systemConfigUpdates.exchangeRates) {
            resolvedBaseForRates =
                systemConfigUpdates.currencyBase ?? (await this.currencyConversion.getBaseCurrency());
        }
        await this.prisma.$transaction(async (tx) => {
            if (hasOrderStatuses) {
                await tx.orderStatus.deleteMany({});
                if (sanitizedOrderStatuses.length) {
                    await tx.orderStatus.createMany({
                        data: sanitizedOrderStatuses.map(({ name, color, code }) => ({
                            name,
                            color: color ?? null,
                            code,
                        })),
                    });
                }
                summary.orderStatuses = sanitizedOrderStatuses.length;
            }
            if (hasCustomerStatuses) {
                await tx.customerStatus.deleteMany({});
                if (sanitizedCustomerStatuses.length) {
                    await tx.customerStatus.createMany({
                        data: sanitizedCustomerStatuses.map(({ name, color }) => ({
                            name,
                            color: color ?? null,
                        })),
                    });
                }
                summary.customerStatuses = sanitizedCustomerStatuses.length;
            }
            if (hasExpenseStatuses) {
                await tx.expenseStatus.deleteMany({});
                if (sanitizedExpenseStatuses.length) {
                    await tx.expenseStatus.createMany({
                        data: sanitizedExpenseStatuses.map(({ name, color }) => ({
                            name,
                            color: color ?? null,
                        })),
                    });
                }
                summary.expenseStatuses = sanitizedExpenseStatuses.length;
            }
            if (hasExpenseCategories) {
                await tx.expenseCategory.deleteMany({});
                if (sanitizedExpenseCategories.length) {
                    await tx.expenseCategory.createMany({
                        data: sanitizedExpenseCategories.map(({ name }) => ({ name })),
                    });
                }
                summary.expenseCategories = sanitizedExpenseCategories.length;
            }
            if (hasProductCategories) {
                await tx.productCategory.deleteMany({});
                if (sanitizedProductCategories.length) {
                    await tx.productCategory.createMany({
                        data: sanitizedProductCategories.map(({ name }) => ({ name })),
                    });
                }
                summary.productCategories = sanitizedProductCategories.length;
            }
            if (hasPaymentMethods) {
                await tx.paymentMethod.deleteMany({});
                if (sanitizedPaymentMethods.length) {
                    await tx.paymentMethod.createMany({
                        data: sanitizedPaymentMethods.map(({ name }) => ({ name })),
                    });
                }
                summary.paymentMethods = sanitizedPaymentMethods.length;
            }
            if (hasShippingOptions) {
                await tx.shippingOption.deleteMany({});
                if (sanitizedShippingOptions.length) {
                    await tx.shippingOption.createMany({
                        data: sanitizedShippingOptions.map(({ name, deliveryFees, estimatedMin, estimatedMax, img }) => ({
                            name,
                            deliveryFees,
                            estimatedMin,
                            estimatedMax,
                            img,
                        })),
                    });
                }
                summary.shippingOptions = sanitizedShippingOptions.length;
            }
            if (hasCalendarEventTypes) {
                await tx.calendarEventType.deleteMany({});
                if (sanitizedCalendarEventTypes.length) {
                    await tx.calendarEventType.createMany({
                        data: sanitizedCalendarEventTypes.map(({ name, color, description }) => ({
                            name,
                            color,
                            description: description ?? null,
                        })),
                    });
                }
                summary.calendarEventTypes = sanitizedCalendarEventTypes.length;
            }
            if (hasCompanyProfile && companyProfileData) {
                const updateCompanyProfileData = {
                    ...companyProfileData,
                    ...(companyProfileLogo !== undefined
                        ? { logo: this.prepareLogoForPersistence(companyProfileLogo) }
                        : {}),
                };
                const createCompanyProfileData = {
                    singleton: this.companySingletonKey,
                    ...companyProfileData,
                    ...(companyProfileLogo !== undefined
                        ? { logo: this.prepareLogoForPersistence(companyProfileLogo) }
                        : {}),
                };
                await tx.companyProfile.upsert({
                    where: { singleton: this.companySingletonKey },
                    update: updateCompanyProfileData,
                    create: createCompanyProfileData,
                });
                summary.companyProfile = 1;
            }
            if (hasSystemConfig) {
                if (systemConfigUpdates.taxRate !== undefined) {
                    await tx.systemConfig.upsert({
                        where: { key: 'taxRate' },
                        update: { value: String(systemConfigUpdates.taxRate) },
                        create: { key: 'taxRate', value: String(systemConfigUpdates.taxRate) },
                    });
                    summary.taxRate = 1;
                }
                if (systemConfigUpdates.currencies) {
                    await this.currencyConversion.setEnabledCurrencies(systemConfigUpdates.currencies, tx);
                    summary.currencies = systemConfigUpdates.currencies.length;
                }
                let currentBase = resolvedBaseForRates;
                if (systemConfigUpdates.currencyBase) {
                    currentBase = await this.currencyConversion.setBaseCurrency(systemConfigUpdates.currencyBase, tx);
                    summary.currencyBase = 1;
                }
                if (systemConfigUpdates.exchangeRates && currentBase) {
                    await this.currencyConversion.replaceRates(currentBase, systemConfigUpdates.exchangeRates, tx);
                    summary.exchangeRates = systemConfigUpdates.exchangeRates.length;
                }
                if (systemConfigUpdates.themeConfig) {
                    await tx.systemConfig.upsert({
                        where: { key: 'themeConfig' },
                        update: { value: JSON.stringify(systemConfigUpdates.themeConfig) },
                        create: {
                            key: 'themeConfig',
                            value: JSON.stringify(systemConfigUpdates.themeConfig),
                        },
                    });
                    summary.themeConfig = 1;
                }
            }
        });
        return { success: true, summary };
    }
    async getSystemConfig() {
        const cfg = await this.prisma.systemConfig.findMany();
        const map = new Map(cfg.map((c) => [c.key, c.value]));
        const taxRate = Number(map.get('taxRate') ?? '22');
        const baseCurrency = await this.currencyConversion.getBaseCurrency();
        const exchangeRates = await this.currencyConversion.listRates(baseCurrency);
        const ratesPayload = exchangeRates.map((rate) => ({
            quote: rate.quote,
            rate: Number(rate.rate.toString()),
            updatedAt: rate.updatedAt ?? null,
        }));
        ratesPayload.unshift({ quote: baseCurrency, rate: 1, updatedAt: null });
        return {
            taxRate: Number.isNaN(taxRate) ? 22 : taxRate,
            currencies: await this.currencyConversion.getEnabledCurrencies(),
            currencyBase: baseCurrency,
            exchangeRates: ratesPayload,
            currencyOptions: this.currencyConversion.getStandardCurrencies(),
        };
    }
    async updateSystemConfig(body) {
        if (body.currencies) {
            const normalized = body.currencies
                .map((code) => this.currencyConversion.normalizeCurrency(code))
                .filter((code) => Boolean(code));
            if (!normalized.length) {
                throw new common_1.BadRequestException('At least one valid currency must be provided');
            }
            await this.currencyConversion.setEnabledCurrencies(normalized);
        }
        if (body.currencyBase) {
            const base = this.currencyConversion.normalizeCurrency(body.currencyBase);
            if (!base) {
                throw new common_1.BadRequestException('Invalid base currency');
            }
            const enabled = await this.currencyConversion.getEnabledCurrencies();
            if (!enabled.includes(base)) {
                await this.currencyConversion.setEnabledCurrencies([base, ...enabled]);
            }
            await this.currencyConversion.setBaseCurrency(base);
        }
        if (body.taxRate !== undefined) {
            const value = Number(body.taxRate);
            if (!Number.isNaN(value)) {
                await this.prisma.systemConfig.upsert({
                    where: { key: 'taxRate' },
                    update: { value: String(value) },
                    create: { key: 'taxRate', value: String(value) },
                });
            }
        }
        return true;
    }
    async getSystemDisclaimer() {
        const record = await this.prisma.systemConfig.findUnique({
            where: { key: this.disclaimerConfigKey },
        });
        return { html: record?.value ?? '' };
    }
    async updateSystemDisclaimer(body) {
        const raw = typeof body.html === 'string' ? body.html : '';
        const sanitized = (0, sanitize_1.sanitizeRichText)(raw, 'html');
        if (!sanitized) {
            try {
                await this.prisma.systemConfig.delete({ where: { key: this.disclaimerConfigKey } });
            }
            catch (error) {
                if (error?.code !== 'P2025') {
                    throw error;
                }
            }
            return { html: '' };
        }
        const record = await this.prisma.systemConfig.upsert({
            where: { key: this.disclaimerConfigKey },
            update: { value: sanitized },
            create: { key: this.disclaimerConfigKey, value: sanitized },
        });
        return { html: record.value };
    }
    async getThemeConfig() {
        const record = await this.prisma.systemConfig.findUnique({ where: { key: 'themeConfig' } });
        if (!record) {
            return this.defaultThemeConfig;
        }
        try {
            const parsed = JSON.parse(record.value);
            return this.sanitizeThemeConfig(parsed);
        }
        catch (error) {
            return this.defaultThemeConfig;
        }
    }
    async updateThemeConfig(body) {
        const sanitized = this.sanitizeThemeConfig(body);
        await this.prisma.systemConfig.upsert({
            where: { key: 'themeConfig' },
            update: { value: JSON.stringify(sanitized) },
            create: { key: 'themeConfig', value: JSON.stringify(sanitized) },
        });
        return sanitized;
    }
    async getCurrencies() {
        return this.currencyConversion.getEnabledCurrencies();
    }
    async getCurrencyOptions() {
        return currency_constants_1.STANDARD_CURRENCIES;
    }
    async getExchangeRates() {
        const baseCurrency = await this.currencyConversion.getBaseCurrency();
        const rates = await this.currencyConversion.listRates(baseCurrency);
        return {
            baseCurrency,
            rates: rates.map((rate) => ({
                quote: rate.quote,
                rate: Number(rate.rate.toString()),
                updatedAt: rate.updatedAt,
            })),
        };
    }
    async updateExchangeRates(body) {
        let baseCurrency = await this.currencyConversion.getBaseCurrency();
        if (body.baseCurrency) {
            baseCurrency = await this.currencyConversion.setBaseCurrency(body.baseCurrency);
        }
        let updatedRates = await this.currencyConversion.listRates(baseCurrency);
        if (Array.isArray(body.rates)) {
            updatedRates = await this.currencyConversion.replaceRates(baseCurrency, body.rates);
        }
        return {
            baseCurrency,
            rates: updatedRates.map((rate) => ({
                quote: rate.quote,
                rate: Number(rate.rate.toString()),
                updatedAt: rate.updatedAt,
            })),
        };
    }
    async createCurrency(body) {
        const code = this.currencyConversion.normalizeCurrency(body.code);
        if (!code) {
            throw new common_1.BadRequestException('Invalid currency code');
        }
        const current = await this.currencyConversion.getEnabledCurrencies();
        if (current.includes(code)) {
            throw new common_1.BadRequestException('Currency already exists');
        }
        return this.currencyConversion.setEnabledCurrencies([...current, code]);
    }
    async updateCurrency(body) {
        const currentCode = this.currencyConversion.normalizeCurrency(body.current);
        const nextCode = this.currencyConversion.normalizeCurrency(body.next);
        if (!currentCode || !nextCode) {
            throw new common_1.BadRequestException('Invalid currency code');
        }
        const list = await this.currencyConversion.getEnabledCurrencies();
        if (!list.includes(currentCode)) {
            throw new common_1.BadRequestException('Currency not found');
        }
        if (currentCode === nextCode) {
            return list;
        }
        if (list.includes(nextCode)) {
            throw new common_1.BadRequestException('Currency already exists');
        }
        const updated = list.map((item) => (item === currentCode ? nextCode : item));
        return this.currencyConversion.setEnabledCurrencies(updated);
    }
    async deleteCurrency(body) {
        const code = this.currencyConversion.normalizeCurrency(body.code);
        if (!code) {
            throw new common_1.BadRequestException('Invalid currency code');
        }
        const list = await this.currencyConversion.getEnabledCurrencies();
        if (!list.includes(code)) {
            throw new common_1.BadRequestException('Currency not found');
        }
        const updated = list.filter((item) => item !== code);
        if (!updated.length) {
            throw new common_1.BadRequestException('At least one currency must remain');
        }
        return this.currencyConversion.setEnabledCurrencies(updated);
    }
    async getCalendarEventTypes() {
        await this.ensureCalendarEventTypesSeeded();
        return this.prisma.calendarEventType.findMany({ orderBy: { id: 'asc' } });
    }
    async createCalendarEventType(body) {
        const name = (body.name || '').trim();
        if (!name) {
            throw new common_1.BadRequestException('Event type name is required');
        }
        const color = this.normalizeColor(body.color);
        const created = await this.prisma.calendarEventType.create({
            data: {
                name,
                color,
                description: body.description?.trim() || null,
            },
        });
        return created;
    }
    async updateCalendarEventType(id, body) {
        const eventTypeId = Number(id);
        if (!Number.isFinite(eventTypeId)) {
            throw new common_1.BadRequestException('Invalid event type id');
        }
        const data = {};
        if (body.name !== undefined) {
            const name = body.name.trim();
            if (!name) {
                throw new common_1.BadRequestException('Event type name cannot be empty');
            }
            data.name = name;
        }
        if (body.color !== undefined) {
            data.color = this.normalizeColor(body.color);
        }
        if (body.description !== undefined) {
            const desc = body.description.trim();
            data.description = desc ? desc : null;
        }
        if (Object.keys(data).length === 0) {
            return this.prisma.calendarEventType.findUnique({ where: { id: eventTypeId } });
        }
        try {
            return await this.prisma.calendarEventType.update({
                where: { id: eventTypeId },
                data,
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new common_1.BadRequestException('Event type not found');
            }
            throw error;
        }
    }
    async deleteCalendarEventType(id) {
        const eventTypeId = Number(id);
        if (!Number.isFinite(eventTypeId)) {
            throw new common_1.BadRequestException('Invalid event type id');
        }
        const remaining = await this.prisma.calendarEventType.count();
        if (remaining <= 1) {
            throw new common_1.BadRequestException('At least one event type must remain');
        }
        try {
            await this.prisma.calendarEventType.delete({ where: { id: eventTypeId } });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new common_1.BadRequestException('Event type not found');
            }
            throw error;
        }
        return true;
    }
    countries() {
        return [
            { code: 'US', name: 'United States' },
            { code: 'CA', name: 'Canada' },
            { code: 'MX', name: 'Mexico' },
            { code: 'UY', name: 'Uruguay' },
            { code: 'AR', name: 'Argentina' },
            { code: 'ES', name: 'Spain' },
            { code: 'JP', name: 'Japan' },
        ];
    }
    cities(country) {
        const all = {
            US: ['New York', 'Los Angeles', 'Chicago', 'Houston'],
            CA: ['Toronto', 'Vancouver', 'Montreal'],
            MX: ['Ciudad de México', 'Guadalajara', 'Monterrey'],
            UY: ['Montevideo', 'Salto', 'Paysandú'],
            AR: ['Buenos Aires', 'Córdoba', 'Rosario'],
            ES: ['Madrid', 'Barcelona', 'Valencia'],
            JP: ['Tokyo', 'Osaka', 'Kyoto'],
        };
        const key = (country || 'US').toUpperCase();
        return (all[key] || all['US']).map((name) => ({ name }));
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('company-profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getCompanyProfile", null);
__decorate([
    (0, common_1.Put)('company-profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateCompanyProfile", null);
__decorate([
    (0, common_1.Get)('order-statuses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getOrderStatuses", null);
__decorate([
    (0, common_1.Post)('order-statuses/create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createOrderStatus", null);
__decorate([
    (0, common_1.Put)('order-statuses/update'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateOrderStatus", null);
__decorate([
    (0, common_1.Delete)('order-statuses/delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteOrderStatus", null);
__decorate([
    (0, common_1.Get)('customer-statuses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getCustomerStatuses", null);
__decorate([
    (0, common_1.Post)('customer-statuses/create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createCustomerStatus", null);
__decorate([
    (0, common_1.Put)('customer-statuses/update'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateCustomerStatus", null);
__decorate([
    (0, common_1.Delete)('customer-statuses/delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteCustomerStatus", null);
__decorate([
    (0, common_1.Get)('expense-statuses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getExpenseStatuses", null);
__decorate([
    (0, common_1.Post)('expense-statuses/create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createExpenseStatus", null);
__decorate([
    (0, common_1.Put)('expense-statuses/update'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateExpenseStatus", null);
__decorate([
    (0, common_1.Delete)('expense-statuses/delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteExpenseStatus", null);
__decorate([
    (0, common_1.Get)('product-categories'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getProductCategories", null);
__decorate([
    (0, common_1.Post)('product-categories/create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createProductCategory", null);
__decorate([
    (0, common_1.Put)('product-categories/update'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateProductCategory", null);
__decorate([
    (0, common_1.Delete)('product-categories/delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteProductCategory", null);
__decorate([
    (0, common_1.Get)('payment-methods'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getPaymentMethods", null);
__decorate([
    (0, common_1.Post)('payment-methods/create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createPaymentMethod", null);
__decorate([
    (0, common_1.Put)('payment-methods/update'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updatePaymentMethod", null);
__decorate([
    (0, common_1.Delete)('payment-methods/delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deletePaymentMethod", null);
__decorate([
    (0, common_1.Get)('shipping-options'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getShippingOptions", null);
__decorate([
    (0, common_1.Post)('shipping-options/create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createShippingOption", null);
__decorate([
    (0, common_1.Put)('shipping-options/update'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateShippingOption", null);
__decorate([
    (0, common_1.Delete)('shipping-options/delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteShippingOption", null);
__decorate([
    (0, common_1.Get)('configurations/export'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "exportConfigurations", null);
__decorate([
    (0, common_1.Post)('configurations/import'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "importConfigurations", null);
__decorate([
    (0, common_1.Get)('system-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSystemConfig", null);
__decorate([
    (0, common_1.Put)('system-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateSystemConfig", null);
__decorate([
    (0, common_1.Get)('system-config/disclaimer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSystemDisclaimer", null);
__decorate([
    (0, common_1.Put)('system-config/disclaimer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateSystemDisclaimer", null);
__decorate([
    (0, common_1.Get)('theme-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getThemeConfig", null);
__decorate([
    (0, common_1.Put)('theme-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateThemeConfig", null);
__decorate([
    (0, common_1.Get)('system-config/currencies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getCurrencies", null);
__decorate([
    (0, common_1.Get)('system-config/currencies/options'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getCurrencyOptions", null);
__decorate([
    (0, common_1.Get)('system-config/exchange-rates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getExchangeRates", null);
__decorate([
    (0, common_1.Put)('system-config/exchange-rates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateExchangeRates", null);
__decorate([
    (0, common_1.Post)('system-config/currencies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createCurrency", null);
__decorate([
    (0, common_1.Put)('system-config/currencies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateCurrency", null);
__decorate([
    (0, common_1.Delete)('system-config/currencies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteCurrency", null);
__decorate([
    (0, common_1.Get)('calendar-event-types'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getCalendarEventTypes", null);
__decorate([
    (0, common_1.Post)('calendar-event-types'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createCalendarEventType", null);
__decorate([
    (0, common_1.Put)('calendar-event-types/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateCalendarEventType", null);
__decorate([
    (0, common_1.Delete)('calendar-event-types/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_decorator_1.ROLES.ADMIN, roles_decorator_1.ROLES.SUPERADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteCalendarEventType", null);
__decorate([
    (0, common_1.Get)('countries'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "countries", null);
__decorate([
    (0, common_1.Get)('cities'),
    __param(0, (0, common_1.Query)('country')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "cities", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('settings'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        currency_conversion_service_1.CurrencyConversionService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map