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
exports.SalesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const product_dto_1 = require("./dto/product.dto");
const pricing_1 = require("./utils/pricing");
const dashboard_dto_1 = require("./dto/dashboard.dto");
const SALES_UNIT_KEYWORDS = {
    [client_1.SalesUnit.UNIT]: ['unit', 'units', 'unidad', 'unidades', 'u'],
    [client_1.SalesUnit.SQUARE_METER]: ['squaremeter', 'squaremeters', 'metroscuadrados', 'metrocuadrado', 'metroscuadrado', 'm2', 'sqm', 'mt2'],
    [client_1.SalesUnit.LINEAR_METER]: ['linearmeter', 'linearmeters', 'metrolineal', 'metroslineales', 'ml', 'lm'],
};
let SalesController = class SalesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTaxRate() {
        const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'taxRate' } });
        const val = Number(cfg?.value ?? '22');
        return Number.isNaN(val) ? 22 : val;
    }
    deriveInventoryStatus(stock, permanent) {
        const numericStock = Number(stock ?? 0);
        const normalizedStock = Number.isNaN(numericStock) ? 0 : numericStock;
        const isPermanent = Boolean(permanent);
        if (isPermanent) {
            return 0;
        }
        if (normalizedStock <= 0) {
            return 2;
        }
        if (normalizedStock < 5) {
            return 1;
        }
        return 0;
    }
    startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    dayKey(date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    formatCsvValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const str = String(value);
        if (/[",\n]/.test(str)) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }
    buildCsv(rows) {
        return rows.map((row) => row.map((cell) => this.formatCsvValue(cell)).join(',')).join('\n');
    }
    normalizeProductSortKey(raw) {
        const key = raw?.toString()?.trim();
        if (!key)
            return undefined;
        const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        switch (normalized) {
            case 'id':
                return 'id';
            case 'name':
                return 'name';
            case 'productcode':
                return 'productCode';
            case 'brand':
                return 'brand';
            case 'vendor':
                return 'vendor';
            case 'price':
            case 'saleprice':
            case 'precioventa':
                return 'salePrice';
            case 'costprice':
            case 'preciocosto':
            case 'costperitem':
                return 'costPrice';
            case 'stock':
                return 'stock';
            case 'status':
                return 'status';
            case 'published':
                return 'published';
            case 'category':
                return 'category';
            default:
                return undefined;
        }
    }
    normalizeSortDirection(raw) {
        const direction = raw?.toString()?.toLowerCase?.() ?? '';
        if (direction === 'asc' || direction === 'ascending' || direction === 'ascend')
            return 'asc';
        if (direction === 'desc' || direction === 'descending' || direction === 'descend')
            return 'desc';
        return undefined;
    }
    buildProductOrderBy(sort) {
        const orderBy = [];
        const key = this.normalizeProductSortKey(sort?.key);
        const order = this.normalizeSortDirection(sort?.order ?? '');
        if (key && order) {
            switch (key) {
                case 'id':
                    orderBy.push({ id: order });
                    break;
                case 'name':
                    orderBy.push({ name: order });
                    break;
                case 'productCode':
                    orderBy.push({ productCode: order });
                    break;
                case 'brand':
                    orderBy.push({ brand: order });
                    break;
                case 'vendor':
                    orderBy.push({ vendor: order });
                    break;
                case 'salePrice':
                    orderBy.push({ salePrice: order });
                    break;
                case 'costPrice':
                    orderBy.push({ costPrice: order });
                    break;
                case 'stock':
                    orderBy.push({ stock: order });
                    break;
                case 'status':
                    orderBy.push({ status: order });
                    break;
                case 'published':
                    orderBy.push({ published: order });
                    break;
                case 'category':
                    orderBy.push({ category: { name: order } });
                    break;
            }
        }
        orderBy.push({ id: 'desc' });
        return orderBy;
    }
    buildProductWhere(dto) {
        const andConditions = [];
        const parseFilterData = (input) => {
            if (!input)
                return undefined;
            if (typeof input === 'string') {
                try {
                    const parsed = JSON.parse(input);
                    return parsed && typeof parsed === 'object' ? parsed : undefined;
                }
                catch {
                    return undefined;
                }
            }
            if (typeof input === 'object') {
                return input;
            }
            return undefined;
        };
        const appendSearch = (value) => {
            const term = value?.toString()?.trim();
            if (!term)
                return;
            andConditions.push({
                OR: [
                    { name: { contains: term, mode: 'insensitive' } },
                    { productCode: { contains: term, mode: 'insensitive' } },
                    { brand: { contains: term, mode: 'insensitive' } },
                    { vendor: { contains: term, mode: 'insensitive' } },
                ],
            });
        };
        appendSearch(dto.query);
        const filterData = parseFilterData(dto?.filterData);
        const filterName = filterData?.name;
        if (typeof filterName === 'string') {
            appendSearch(filterName);
        }
        const currencySelection = filterData?.currency;
        const currencyList = [];
        const pushCurrency = (value) => {
            if (typeof value !== 'string' && typeof value !== 'number')
                return;
            const normalized = String(value).trim().toUpperCase();
            if (!normalized || !/^[A-Z]{3,5}$/.test(normalized))
                return;
            if (!currencyList.includes(normalized)) {
                currencyList.push(normalized);
            }
        };
        if (Array.isArray(currencySelection)) {
            for (const item of currencySelection) {
                pushCurrency(item);
            }
        }
        else if (currencySelection !== undefined && currencySelection !== null) {
            pushCurrency(currencySelection);
        }
        if (currencyList.length) {
            andConditions.push({
                currency: { in: currencyList },
            });
        }
        if (!andConditions.length)
            return {};
        return { AND: andConditions };
    }
    normalizeHeaderKey(key) {
        if (!key)
            return '';
        return key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    parseCsv(content) {
        const normalized = content.replace(/^\uFEFF/, '');
        const lines = normalized.split(/\r?\n/);
        const rows = [];
        for (const rawLine of lines) {
            if (!rawLine || !rawLine.trim())
                continue;
            const cells = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < rawLine.length; i += 1) {
                const ch = rawLine[i];
                if (ch === '"') {
                    if (inQuotes && rawLine[i + 1] === '"') {
                        current += '"';
                        i += 1;
                    }
                    else {
                        inQuotes = !inQuotes;
                    }
                }
                else if (ch === ',' && !inQuotes) {
                    cells.push(current);
                    current = '';
                }
                else {
                    current += ch;
                }
            }
            cells.push(current);
            rows.push(cells.map((cell) => cell.trim()));
        }
        return rows;
    }
    getCell(row, columnIndex, key, aliases = []) {
        const keys = [key, ...aliases];
        for (const candidate of keys) {
            const normalized = this.normalizeHeaderKey(candidate);
            if (!normalized)
                continue;
            const idx = columnIndex.get(normalized);
            if (idx !== undefined) {
                return (row[idx] ?? '').trim();
            }
        }
        return '';
    }
    parseNumber(value) {
        if (value === null || value === undefined)
            return 0;
        const raw = typeof value === 'number' ? value.toString() : value;
        const trimmed = raw.trim();
        if (!trimmed)
            return 0;
        const numericLike = trimmed.replace(/\s+/g, '');
        const dotNormalized = numericLike.includes(',') && !numericLike.includes('.')
            ? numericLike.replace(/,/g, '.')
            : numericLike.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '');
        const direct = Number(dotNormalized);
        if (!Number.isNaN(direct))
            return direct;
        const fallback = Number(dotNormalized.replace(/[^0-9.\-]/g, ''));
        return Number.isNaN(fallback) ? 0 : fallback;
    }
    parseDate(value) {
        if (value === null || value === undefined)
            return undefined;
        const raw = typeof value === 'number' ? value.toString() : value;
        const trimmed = raw.trim();
        if (!trimmed)
            return undefined;
        const num = Number(trimmed);
        if (!Number.isNaN(num) && trimmed.length <= 13) {
            const millis = trimmed.length <= 10 ? num * 1000 : num;
            const dateFromNum = new Date(millis);
            if (!Number.isNaN(dateFromNum.getTime()))
                return dateFromNum;
        }
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime()))
            return parsed;
        return undefined;
    }
    parseOptionalBoolean(raw) {
        if (raw === null || raw === undefined)
            return undefined;
        if (typeof raw === 'boolean')
            return raw;
        const str = raw.toString().trim();
        if (!str)
            return undefined;
        const normalized = str.toLowerCase();
        if (['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(normalized))
            return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(normalized))
            return false;
        return undefined;
    }
    parseSalesUnit(raw) {
        if (raw === null || raw === undefined)
            return undefined;
        const str = raw.toString().trim();
        if (!str)
            return undefined;
        const upper = str.toUpperCase();
        if (Object.values(client_1.SalesUnit).includes(upper)) {
            return upper;
        }
        const normalized = str
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[^\w]+/g, '');
        for (const [unit, keywords] of Object.entries(SALES_UNIT_KEYWORDS)) {
            if (keywords.includes(normalized)) {
                return unit;
            }
        }
        return undefined;
    }
    normalizeOptionalString(value) {
        const trimmed = value?.toString?.().trim?.();
        return trimmed ? trimmed : undefined;
    }
    splitTags(value) {
        const normalized = this.normalizeOptionalString(value);
        if (!normalized)
            return undefined;
        const items = normalized
            .split(/[|,]/)
            .map((tag) => tag.trim())
            .filter(Boolean);
        return items.length ? items : undefined;
    }
    async resolveCategoryId(name, cache) {
        const normalized = this.normalizeOptionalString(name);
        if (!normalized)
            return undefined;
        const key = normalized.toLowerCase();
        if (cache.has(key))
            return cache.get(key);
        let category = await this.prisma.productCategory.findFirst({
            where: { name: { equals: normalized, mode: 'insensitive' } },
        });
        if (!category) {
            category = await this.prisma.productCategory.create({ data: { name: normalized } });
        }
        cache.set(key, category.id);
        return category.id;
    }
    async resolveCustomer(email, name, phone, cache) {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail)
            throw new Error('customerEmail is required');
        const cached = cache.get(normalizedEmail);
        if (cached)
            return cached;
        let customer = await this.prisma.customer.findFirst({ where: { email: normalizedEmail } });
        const trimmedName = name?.trim?.() || normalizedEmail;
        const phoneNumber = phone?.trim?.() || undefined;
        if (!customer) {
            const parts = trimmedName.split(/\s+/).filter(Boolean);
            const firstName = parts.shift() || '';
            const lastName = parts.join(' ');
            customer = await this.prisma.customer.create({
                data: {
                    email: normalizedEmail,
                    name: trimmedName,
                    firstName: firstName || null,
                    lastName: lastName || null,
                    phoneNumber: phoneNumber || null,
                },
            });
        }
        else {
            const updates = {};
            if (trimmedName && (!customer.name || customer.name !== trimmedName)) {
                updates.name = trimmedName;
            }
            if (trimmedName && (!customer.firstName || !customer.lastName)) {
                const parts = trimmedName.split(/\s+/).filter(Boolean);
                if (!customer.firstName && parts[0])
                    updates.firstName = parts[0];
                if (!customer.lastName && parts.length > 1)
                    updates.lastName = parts.slice(1).join(' ');
            }
            if (phoneNumber && !customer.phoneNumber) {
                updates.phoneNumber = phoneNumber;
            }
            if (Object.keys(updates).length > 0) {
                customer = await this.prisma.customer.update({
                    where: { id: customer.id },
                    data: updates,
                });
            }
        }
        cache.set(normalizedEmail, customer);
        return customer;
    }
    async resolvePaymentMethod(methodName, cache) {
        const normalizedName = (methodName || 'Cash').trim();
        if (!normalizedName)
            return undefined;
        const key = normalizedName.toLowerCase();
        if (cache.has(key))
            return cache.get(key);
        let method = await this.prisma.paymentMethod.findFirst({
            where: { name: { equals: normalizedName, mode: 'insensitive' } },
        });
        if (!method) {
            method = await this.prisma.paymentMethod.create({ data: { name: normalizedName } });
        }
        cache.set(key, method.id);
        return method.id;
    }
    async resolveStatus(row, columnIndex, byId, byName, fallbackId) {
        const rawStatusId = this.getCell(row, columnIndex, 'statusId', ['status']);
        const numericStatus = rawStatusId ? Math.round(this.parseNumber(rawStatusId)) : 0;
        if (numericStatus > 0) {
            if (byId.has(numericStatus))
                return byId.get(numericStatus);
            const status = await this.prisma.orderStatus.findUnique({ where: { id: numericStatus } });
            if (status) {
                byId.set(status.id, status.id);
                if (status.name)
                    byName.set(status.name.toLowerCase(), status.id);
                return status.id;
            }
        }
        const rawStatusName = this.getCell(row, columnIndex, 'statusName');
        if (rawStatusName) {
            const normalizedName = rawStatusName.trim().toLowerCase();
            if (normalizedName && byName.has(normalizedName)) {
                return byName.get(normalizedName);
            }
            const status = await this.prisma.orderStatus.findFirst({
                where: { name: { equals: rawStatusName, mode: 'insensitive' } },
            });
            if (status) {
                byId.set(status.id, status.id);
                if (status.name)
                    byName.set(status.name.toLowerCase(), status.id);
                return status.id;
            }
        }
        return fallbackId;
    }
    async dashboard(dto) {
        const { startDate, endDate } = dto ?? {};
        const dateRange = {};
        if (typeof startDate === 'number' && !Number.isNaN(startDate)) {
            dateRange.gte = new Date(startDate * 1000);
        }
        if (typeof endDate === 'number' && !Number.isNaN(endDate)) {
            dateRange.lte = new Date(endDate * 1000);
        }
        const where = { documentType: client_1.DocumentType.ORDER };
        if (Object.keys(dateRange).length > 0) {
            where.date = dateRange;
        }
        const orders = await this.prisma.order.findMany({
            where,
            include: { items: { include: { product: true } } },
        });
        let revenue = 0;
        let totalCost = 0;
        const categories = [];
        const revenueSeries = [];
        const netIncomeSeries = [];
        const revenueByDay = new Map();
        const netIncomeByDay = new Map();
        const revenueByMonth = new Map();
        const netIncomeByMonth = new Map();
        const hourlyRevenue = Array.from({ length: 24 }, () => 0);
        const hourlyNetIncome = Array.from({ length: 24 }, () => 0);
        const qtyByProduct = new Map();
        for (const order of orders) {
            const orderDateObj = new Date(order.date);
            const date = this.startOfDay(orderDateObj);
            const key = this.dayKey(date);
            let orderSales = 0;
            let orderCost = 0;
            for (const item of order.items) {
                const qty = item.qty || 0;
                if (item.productId) {
                    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + qty);
                }
                const { saleTotal: lineSale, costTotal: lineCost } = (0, pricing_1.calculateOrderLineTotals)({
                    price: item.price,
                    qty: item.qty,
                    product: item.product ?? undefined,
                });
                orderSales += lineSale;
                orderCost += lineCost;
            }
            revenue += orderSales;
            totalCost += orderCost;
            const orderNetIncome = orderSales - orderCost;
            const currentRevenue = revenueByDay.get(key) ?? 0;
            revenueByDay.set(key, currentRevenue + orderSales);
            netIncomeByDay.set(key, (netIncomeByDay.get(key) ?? 0) + orderNetIncome);
            const monthKey = `${orderDateObj.getFullYear()}-${orderDateObj.getMonth()}`;
            revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) ?? 0) + orderSales);
            netIncomeByMonth.set(monthKey, (netIncomeByMonth.get(monthKey) ?? 0) + orderNetIncome);
            const hour = orderDateObj.getHours();
            if (hour >= 0 && hour < 24) {
                hourlyRevenue[hour] += orderSales;
                hourlyNetIncome[hour] += orderNetIncome;
            }
        }
        let rangeStart = typeof startDate === 'number' ? this.startOfDay(new Date(startDate * 1000)) : undefined;
        let rangeEnd = typeof endDate === 'number' ? this.startOfDay(new Date(endDate * 1000)) : undefined;
        if (!rangeStart && orders.length > 0) {
            const minDate = orders.reduce((min, order) => {
                const current = this.startOfDay(new Date(order.date));
                return current < min ? current : min;
            }, this.startOfDay(new Date(orders[0].date)));
            rangeStart = minDate;
        }
        if (!rangeEnd && orders.length > 0) {
            const maxDate = orders.reduce((max, order) => {
                const current = this.startOfDay(new Date(order.date));
                return current > max ? current : max;
            }, this.startOfDay(new Date(orders[0].date)));
            rangeEnd = maxDate;
        }
        if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
            const today = this.startOfDay(new Date());
            rangeStart = today;
            rangeEnd = today;
        }
        const dayMs = 24 * 60 * 60 * 1000;
        const totalSpanDays = rangeEnd && rangeStart
            ? Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / dayMs)
            : 0;
        const isSingleDayRange = !rangeStart || !rangeEnd ? true : totalSpanDays <= 0;
        const isFullYearRange = !!rangeStart &&
            !!rangeEnd &&
            rangeStart.getFullYear() === rangeEnd.getFullYear() &&
            rangeStart.getMonth() === 0 &&
            rangeStart.getDate() === 1 &&
            rangeEnd.getMonth() === 11;
        const granularity = isSingleDayRange
            ? 'hour'
            : isFullYearRange
                ? 'month'
                : 'day';
        if (granularity === 'hour') {
            const base = rangeStart ?? this.startOfDay(new Date());
            for (let hour = 0; hour < 24; hour++) {
                const bucketTime = new Date(base);
                bucketTime.setHours(hour, 0, 0, 0);
                categories.push(Math.floor(bucketTime.getTime() / 1000));
                revenueSeries.push(Math.round((hourlyRevenue[hour] + Number.EPSILON) * 100) / 100);
                netIncomeSeries.push(Math.round((hourlyNetIncome[hour] + Number.EPSILON) * 100) / 100);
            }
        }
        else if (granularity === 'month') {
            const year = rangeStart?.getFullYear() ?? new Date().getFullYear();
            for (let month = 0; month < 12; month++) {
                const bucketTime = new Date(year, month, 1);
                const monthKey = `${year}-${month}`;
                categories.push(Math.floor(bucketTime.getTime() / 1000));
                revenueSeries.push(Math.round(((revenueByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
                    100);
                netIncomeSeries.push(Math.round(((netIncomeByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
                    100);
            }
        }
        else {
            for (let ts = rangeStart.getTime(); ts <= rangeEnd.getTime(); ts += dayMs) {
                const current = new Date(ts);
                current.setHours(0, 0, 0, 0);
                const key = this.dayKey(current);
                const bucketRevenue = revenueByDay.get(key) ?? 0;
                const bucketNetIncome = netIncomeByDay.get(key) ?? 0;
                categories.push(Math.floor(current.getTime() / 1000));
                revenueSeries.push(Math.round((bucketRevenue + Number.EPSILON) * 100) / 100);
                netIncomeSeries.push(Math.round((bucketNetIncome + Number.EPSILON) * 100) / 100);
            }
        }
        const products = await this.prisma.product.findMany();
        const topProducts = products
            .map((p) => ({
            id: String(p.id),
            name: p.name,
            img: p.img || '',
            sold: qtyByProduct.get(p.id) || 0,
            specifications: p.specifications ?? undefined,
        }))
            .filter((p) => p.sold > 0)
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 6);
        const latest = await this.prisma.order.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { customer: true, paymentMethod: true },
            take: 8,
        });
        const latestOrderData = latest.map((o) => ({
            id: String(o.id),
            date: Math.floor(new Date(o.date).getTime() / 1000),
            customer: o.customer?.name || '',
            status: o.statusId || 0,
            paymentMehod: o.paymentMethod?.name || '',
            paymentIdendifier: '',
            totalAmount: o.grandTotal,
        }));
        const cats = await this.prisma.productCategory.findMany({ include: { products: true } });
        const categorySummary = cats
            .map((category) => {
            const label = category.name?.trim();
            const value = category.products.reduce((sum, product) => sum + (qtyByProduct.get(product.id) || 0), 0);
            return { label, value };
        })
            .filter((item) => Boolean(item.label))
            .sort((a, b) => b.value - a.value);
        const categoryLabels = categorySummary.map((item) => item.label);
        const categoryTotals = categorySummary.map((item) => item.value);
        const netIncome = revenue - totalCost;
        return {
            statisticData: {
                orders: { value: orders.length, growShrink: 0 },
                revenue: { value: Math.round(revenue * 100) / 100, growShrink: 0 },
                netIncome: { value: Math.round(netIncome * 100) / 100, growShrink: 0 },
            },
            salesReportData: {
                series: [
                    { name: 'Revenue', data: revenueSeries },
                    { name: 'Net Income', data: netIncomeSeries },
                ],
                categories,
                granularity,
            },
            topProductsData: topProducts,
            latestOrderData,
            salesByCategoriesData: { labels: categoryLabels, data: categoryTotals },
        };
    }
    async listProducts(dto) {
        const where = this.buildProductWhere(dto);
        const total = await this.prisma.product.count({ where });
        const pageIndex = Number(dto.pageIndex || 1);
        const pageSize = Number(dto.pageSize || 50);
        const orderBy = this.buildProductOrderBy(dto.sort);
        const rows = await this.prisma.product.findMany({
            where,
            orderBy,
            skip: (pageIndex - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                name: true,
                productCode: true,
                img: true,
                salePrice: true,
                costPrice: true,
                currency: true,
                unitOfMeasure: true,
                stock: true,
                permanentStock: true,
                status: true,
                published: true,
                tags: true,
                brand: true,
                vendor: true,
                category: { select: { name: true } },
                specifications: true,
            },
        });
        const data = rows.map((p) => ({
            id: String(p.id),
            name: p.name,
            productCode: p.productCode || '',
            img: p.img || '',
            category: p.category?.name || '',
            salePrice: (0, pricing_1.decimalToNumber)(p.salePrice),
            costPrice: (0, pricing_1.decimalToNumber)(p.costPrice),
            currency: p.currency,
            unitOfMeasure: p.unitOfMeasure,
            stock: p.stock,
            permanentStock: p.permanentStock,
            status: this.deriveInventoryStatus(p.stock, p.permanentStock),
            published: p.published,
            tags: p.tags || [],
            brand: p.brand || '',
            vendor: p.vendor || '',
            specifications: p.specifications ?? '',
        }));
        return { data, total };
    }
    async exportProducts(dto) {
        const where = this.buildProductWhere(dto);
        const orderBy = this.buildProductOrderBy(dto.sort);
        const products = await this.prisma.product.findMany({
            where,
            orderBy,
            include: {
                category: { select: { name: true } },
            },
        });
        const statusLabel = {
            0: 'In Stock',
            1: 'Limited',
            2: 'Out of Stock',
        };
        const header = [
            'id',
            'name',
            'description',
            'productCode',
            'brand',
            'vendor',
            'category',
            'salePrice',
            'costPrice',
            'currency',
            'unitOfMeasure',
            'stock',
            'status',
            'statusLabel',
            'permanentStock',
            'published',
            'tags',
            'specifications',
            'createdAt',
            'updatedAt',
        ];
        const rows = products.map((product) => {
            const statusValue = Number(product.status ?? this.deriveInventoryStatus(product.stock, product.permanentStock));
            const salePriceValue = product.salePrice !== null && product.salePrice !== undefined
                ? (0, pricing_1.decimalToNumber)(product.salePrice).toFixed(2)
                : '';
            const costPriceValue = product.costPrice !== null && product.costPrice !== undefined
                ? (0, pricing_1.decimalToNumber)(product.costPrice).toFixed(2)
                : '';
            const tags = Array.isArray(product.tags) ? product.tags.join('|') : '';
            const created = product.createdAt instanceof Date ? product.createdAt : new Date(product.createdAt ?? undefined);
            const updated = product.updatedAt instanceof Date ? product.updatedAt : new Date(product.updatedAt ?? undefined);
            return [
                product.id,
                product.name,
                product.description ?? '',
                product.productCode ?? '',
                product.brand ?? '',
                product.vendor ?? '',
                product.category?.name ?? '',
                salePriceValue,
                costPriceValue,
                product.currency ?? '',
                product.unitOfMeasure ?? client_1.SalesUnit.UNIT,
                product.stock ?? 0,
                statusValue,
                statusLabel[statusValue] ?? '',
                product.permanentStock ? 'true' : 'false',
                product.published ? 'true' : 'false',
                tags,
                product.specifications ?? '',
                Number.isNaN(created.getTime()) ? '' : created.toISOString(),
                Number.isNaN(updated.getTime()) ? '' : updated.toISOString(),
            ];
        });
        const csv = this.buildCsv([header, ...rows]);
        const filename = `products-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        return new common_1.StreamableFile(Buffer.from(csv, 'utf8'), {
            type: 'text/csv; charset=utf-8',
            disposition: `attachment; filename="${filename}"`,
        });
    }
    async importProducts(req) {
        const file = await req?.file?.();
        if (!file)
            throw new common_1.BadRequestException('sales.productList.import.fileRequired');
        const buffer = await file.toBuffer();
        if (!buffer || buffer.length === 0)
            throw new common_1.BadRequestException('sales.productList.import.emptyFile');
        const rows = this.parseCsv(buffer.toString('utf8'));
        if (!rows.length)
            throw new common_1.BadRequestException('sales.productList.import.emptyFile');
        const header = rows.shift() ?? [];
        const columnIndex = new Map();
        header.forEach((col, idx) => {
            const normalized = this.normalizeHeaderKey(col);
            if (normalized)
                columnIndex.set(normalized, idx);
        });
        if (!columnIndex.has(this.normalizeHeaderKey('name'))) {
            throw new common_1.BadRequestException('Missing required column: name');
        }
        const categoryCache = new Map();
        const errors = [];
        let created = 0;
        let updated = 0;
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const lineNumber = i + 2;
            try {
                const idRaw = this.getCell(row, columnIndex, 'id');
                const id = idRaw ? Math.round(this.parseNumber(idRaw)) : undefined;
                const codeRaw = this.getCell(row, columnIndex, 'productCode', ['code', 'sku']);
                const productCode = this.normalizeOptionalString(codeRaw);
                const nameRaw = this.getCell(row, columnIndex, 'name', ['productname']);
                const name = this.normalizeOptionalString(nameRaw);
                if (!name)
                    throw new Error('Product name is required');
                const description = this.normalizeOptionalString(this.getCell(row, columnIndex, 'description', ['desc']));
                const specifications = this.normalizeOptionalString(this.getCell(row, columnIndex, 'specifications', ['specs', 'especificaciones', 'detalles']));
                const img = this.normalizeOptionalString(this.getCell(row, columnIndex, 'img', ['image', 'imageurl']));
                const brand = this.normalizeOptionalString(this.getCell(row, columnIndex, 'brand'));
                const vendor = this.normalizeOptionalString(this.getCell(row, columnIndex, 'vendor'));
                const categoryName = this.normalizeOptionalString(this.getCell(row, columnIndex, 'category', ['categoryname']));
                const tags = this.splitTags(this.getCell(row, columnIndex, 'tags'));
                const currencyRaw = this.normalizeOptionalString(this.getCell(row, columnIndex, 'currency', ['currencycode']));
                const currency = currencyRaw ? currencyRaw.toUpperCase() : undefined;
                const unitRaw = this.normalizeOptionalString(this.getCell(row, columnIndex, 'unitOfMeasure', ['salesUnit', 'unit', 'unitType', 'unidadVenta', 'unidad', 'unidad_de_venta']));
                const salePriceRaw = this.getCell(row, columnIndex, 'salePrice', ['price', 'precioVenta', 'precioventa', 'precio_venta']);
                const stockRaw = this.getCell(row, columnIndex, 'stock');
                const taxRateRaw = this.getCell(row, columnIndex, 'taxRate', ['tax']);
                const costPriceRaw = this.getCell(row, columnIndex, 'costPrice', ['cost', 'costPerItem', 'precioCosto', 'preciocosto', 'precio_costo']);
                const bulkRaw = this.getCell(row, columnIndex, 'bulkDiscountPrice', ['bulkprice']);
                const permanentRaw = this.getCell(row, columnIndex, 'permanentStock', ['permanent']);
                const publishedRaw = this.getCell(row, columnIndex, 'published');
                const createdAtRaw = this.getCell(row, columnIndex, 'createdAt');
                const salePrice = salePriceRaw === '' ? undefined : this.parseNumber(salePriceRaw);
                const stock = stockRaw === '' ? undefined : this.parseNumber(stockRaw);
                const taxRate = taxRateRaw === '' ? undefined : this.parseNumber(taxRateRaw);
                const costPrice = costPriceRaw === '' ? undefined : this.parseNumber(costPriceRaw);
                const bulkDiscountPrice = bulkRaw === '' ? undefined : this.parseNumber(bulkRaw);
                const permanentStock = this.parseOptionalBoolean(permanentRaw);
                const published = this.parseOptionalBoolean(publishedRaw);
                const createdAt = this.parseDate(createdAtRaw);
                const unitOfMeasure = this.parseSalesUnit(unitRaw);
                const resolvedCostPrice = costPrice !== undefined
                    ? (0, pricing_1.roundCurrency)(costPrice)
                    : salePrice !== undefined
                        ? (0, pricing_1.costPriceFromSale)(salePrice)
                        : 0;
                const resolvedSalePrice = salePrice !== undefined
                    ? (0, pricing_1.roundCurrency)(salePrice)
                    : (0, pricing_1.salePriceFromCost)(resolvedCostPrice);
                let product = id && id > 0
                    ? await this.prisma.product.findUnique({ where: { id } })
                    : null;
                if (!product && productCode) {
                    product = await this.prisma.product.findFirst({
                        where: { productCode: productCode },
                    });
                }
                const categoryId = await this.resolveCategoryId(categoryName, categoryCache);
                if (!product) {
                    const fallbackTax = taxRate ?? (await this.getTaxRate());
                    const normalizedStock = stock ?? 0;
                    const normalizedPermanent = permanentStock ?? false;
                    const status = this.deriveInventoryStatus(normalizedStock, normalizedPermanent);
                    const createData = {
                        name,
                        productCode: productCode ?? undefined,
                        description: description ?? undefined,
                        specifications: specifications ?? undefined,
                        img: img ?? undefined,
                        salePrice: resolvedSalePrice,
                        costPrice: resolvedCostPrice,
                        currency: (currency ?? 'UYU').toUpperCase(),
                        unitOfMeasure: unitOfMeasure ?? client_1.SalesUnit.UNIT,
                        stock: Math.round(normalizedStock),
                        permanentStock: normalizedPermanent,
                        status,
                        costPerItem: resolvedCostPrice,
                        bulkDiscountPrice: bulkDiscountPrice ?? undefined,
                        taxRate: fallbackTax,
                        tags: tags ?? [],
                        brand: brand ?? undefined,
                        vendor: vendor ?? undefined,
                        published: published ?? false,
                    };
                    if (categoryId) {
                        createData.category = { connect: { id: categoryId } };
                    }
                    if (createdAt && !Number.isNaN(createdAt.getTime())) {
                        createData.createdAt = createdAt;
                    }
                    await this.prisma.product.create({ data: createData });
                    created += 1;
                }
                else {
                    const updateData = {
                        name,
                    };
                    if (productCode !== undefined)
                        updateData.productCode = productCode;
                    if (description !== undefined)
                        updateData.description = description;
                    if (specifications !== undefined)
                        updateData.specifications = specifications;
                    if (img !== undefined)
                        updateData.img = img;
                    if (currency)
                        updateData.currency = currency;
                    if (salePrice !== undefined) {
                        updateData.salePrice = resolvedSalePrice;
                    }
                    if (costPrice !== undefined) {
                        updateData.costPrice = resolvedCostPrice;
                        updateData.costPerItem = resolvedCostPrice;
                    }
                    if (stock !== undefined)
                        updateData.stock = Math.round(stock);
                    if (permanentStock !== undefined)
                        updateData.permanentStock = permanentStock;
                    if (bulkDiscountPrice !== undefined)
                        updateData.bulkDiscountPrice = bulkDiscountPrice;
                    if (taxRate !== undefined)
                        updateData.taxRate = taxRate;
                    if (tags !== undefined)
                        updateData.tags = tags;
                    if (brand !== undefined)
                        updateData.brand = brand;
                    if (vendor !== undefined)
                        updateData.vendor = vendor;
                    if (published !== undefined)
                        updateData.published = published;
                    if (unitOfMeasure !== undefined)
                        updateData.unitOfMeasure = unitOfMeasure;
                    if (categoryId) {
                        updateData.category = { connect: { id: categoryId } };
                    }
                    const nextStock = stock !== undefined ? stock : product.stock ?? 0;
                    const nextPermanent = permanentStock !== undefined ? permanentStock : product.permanentStock ?? false;
                    updateData.status = this.deriveInventoryStatus(Number(nextStock), Boolean(nextPermanent));
                    await this.prisma.product.update({
                        where: { id: product.id },
                        data: updateData,
                    });
                    updated += 1;
                }
            }
            catch (error) {
                let message = 'Unknown import error';
                if (error instanceof common_1.BadRequestException) {
                    const response = error.getResponse();
                    message = response?.message || error.message;
                }
                else if (error instanceof Error) {
                    message = error.message;
                }
                errors.push({ row: lineNumber, message });
            }
        }
        return {
            success: errors.length === 0,
            imported: created + updated,
            created,
            updated,
            failed: errors.length,
            errors,
        };
    }
    async getProduct(id) {
        const nId = Number(id);
        const data = await this.prisma.product.findUnique({
            where: { id: nId },
            include: { images: true, category: true },
        });
        if (!data)
            return null;
        return {
            ...data,
            salePrice: (0, pricing_1.decimalToNumber)(data.salePrice),
            costPrice: (0, pricing_1.decimalToNumber)(data.costPrice),
        };
    }
    async createProduct(dto) {
        const tags = (dto.tags || []).map((t) => (typeof t === 'string' ? t : t.value));
        const taxRate = await this.getTaxRate();
        const permanentStock = dto.permanentStock ?? false;
        const status = this.deriveInventoryStatus(dto.stock, permanentStock);
        await this.prisma.product.create({
            data: {
                name: dto.name,
                productCode: dto.productCode,
                img: dto.img,
                description: dto.description,
                specifications: dto.specifications?.trim?.() ? dto.specifications.trim() : null,
                categoryId: dto.categoryId,
                salePrice: (0, pricing_1.roundCurrency)(dto.salePrice),
                costPrice: (0, pricing_1.roundCurrency)(dto.costPrice),
                currency: (dto.currency || 'UYU').toUpperCase(),
                unitOfMeasure: dto.unitOfMeasure ?? client_1.SalesUnit.UNIT,
                stock: dto.stock,
                permanentStock,
                status,
                costPerItem: dto.costPerItem ?? (0, pricing_1.roundCurrency)(dto.costPrice),
                bulkDiscountPrice: dto.bulkDiscountPrice,
                taxRate,
                tags,
                brand: dto.brand,
                vendor: dto.vendor,
                published: dto.published ?? false,
                images: dto.imgList && dto.imgList.length ? {
                    create: dto.imgList.map((im, idx) => ({ name: im.name, img: im.img, sortOrder: idx }))
                } : undefined,
            },
        });
        return true;
    }
    async updateProduct(dto) {
        if (!dto.id)
            return false;
        const tags = dto.tags === undefined
            ? undefined
            : ((dto.tags || []).map((t) => (typeof t === 'string' ? t : t.value)));
        const taxRate = await this.getTaxRate();
        const normalizedSalePrice = dto.salePrice === undefined ? undefined : (0, pricing_1.roundCurrency)(dto.salePrice);
        const normalizedCostPrice = dto.costPrice === undefined ? undefined : (0, pricing_1.roundCurrency)(dto.costPrice);
        const updateData = {
            name: dto.name,
            productCode: dto.productCode,
            img: dto.img,
            description: dto.description,
            specifications: dto.specifications === undefined
                ? undefined
                : dto.specifications?.trim?.()
                    ? dto.specifications.trim()
                    : null,
            salePrice: normalizedSalePrice,
            costPrice: normalizedCostPrice,
            stock: dto.stock,
            costPerItem: dto.costPerItem === undefined ? normalizedCostPrice : (0, pricing_1.roundCurrency)(dto.costPerItem),
            bulkDiscountPrice: dto.bulkDiscountPrice,
            taxRate,
            tags,
            brand: dto.brand,
            vendor: dto.vendor,
            permanentStock: dto.permanentStock === undefined ? undefined : dto.permanentStock,
            currency: dto.currency === undefined
                ? undefined
                : (dto.currency || 'UYU').toUpperCase(),
            unitOfMeasure: dto.unitOfMeasure === undefined ? undefined : dto.unitOfMeasure,
            published: dto.published === undefined ? undefined : dto.published,
        };
        const existing = await this.prisma.product.findUnique({
            where: { id: dto.id },
            select: { stock: true, permanentStock: true },
        });
        if (!existing) {
            throw new common_1.BadRequestException('Product not found');
        }
        const nextStock = dto.stock !== undefined ? dto.stock : existing.stock;
        const nextPermanent = dto.permanentStock !== undefined ? dto.permanentStock : existing.permanentStock;
        updateData.status = this.deriveInventoryStatus(nextStock, nextPermanent);
        if (dto.categoryId !== undefined) {
            updateData.categoryId = dto.categoryId;
        }
        if (dto.imgList) {
            updateData.images = {
                deleteMany: {},
                create: dto.imgList.map((im, idx) => ({ name: im.name, img: im.img, sortOrder: idx })),
            };
            if (!dto.img && dto.imgList.length > 0) {
                updateData.img = dto.imgList[0].img;
            }
        }
        await this.prisma.product.update({
            where: { id: dto.id },
            data: updateData,
        });
        return true;
    }
    async deleteProducts(body) {
        const ids = Array.isArray(body.id) ? body.id : [body.id];
        const numIds = ids.map((x) => Number(x)).filter(Boolean);
        await this.prisma.product.deleteMany({ where: { id: { in: numIds } } });
        return true;
    }
};
exports.SalesController = SalesController;
__decorate([
    (0, common_1.Post)('dashboard'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dashboard_dto_1.DashboardFilterDto]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [product_dto_1.TableQueryDto]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "listProducts", null);
__decorate([
    (0, common_1.Post)('products/export'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [product_dto_1.TableQueryDto]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "exportProducts", null);
__decorate([
    (0, common_1.Post)('products/import'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "importProducts", null);
__decorate([
    (0, common_1.Get)('product'),
    __param(0, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Post)('products/create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [product_dto_1.UpsertProductDto]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Put)('products/update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)('products/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "deleteProducts", null);
exports.SalesController = SalesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('sales'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesController);
//# sourceMappingURL=sales.controller.js.map