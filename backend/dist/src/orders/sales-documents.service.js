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
exports.SalesDocumentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const prisma_service_1 = require("../prisma/prisma.service");
const currency_conversion_service_1 = require("../common/currency/currency-conversion.service");
const documents_1 = require("../common/uploads/documents");
const sanitize_1 = require("../common/utils/sanitize");
const money_util_1 = require("../common/currency/money.util");
const order_finance_service_1 = require("./order-finance.service");
const BUDGET_STATUS = {
    DRAFT: { code: 1000, name: 'Presupuesto - Borrador', color: '#9ca3af' },
    SENT: { code: 1010, name: 'Presupuesto - Enviado', color: '#3b82f6' },
    ACCEPTED: { code: 1020, name: 'Presupuesto - Aceptado', color: '#10b981' },
    CONVERTED: { code: 1030, name: 'Presupuesto - Convertido', color: '#22c55e' },
    CANCELED: { code: 1040, name: 'Presupuesto - Cancelado', color: '#ef4444' },
    EXPIRED: { code: 1050, name: 'Presupuesto - Expirado', color: '#f97316' },
};
const SALES_UNIT_KEYWORDS = {
    [client_1.SalesUnit.UNIT]: ['unit', 'units', 'unidad', 'unidades', 'u'],
    [client_1.SalesUnit.SQUARE_METER]: [
        'squaremeter',
        'squaremeters',
        'metroscuadrados',
        'metrocuadrado',
        'metroscuadrado',
        'm2',
        'sqm',
        'mt2',
    ],
    [client_1.SalesUnit.LINEAR_METER]: [
        'linearmeter',
        'linearmeters',
        'metrolineal',
        'metroslineales',
        'ml',
        'lm',
    ],
};
const ORDER_STATUS_CODES = {
    PENDING: 100,
    CONFIRMED: 200,
    WORK_ORDER: 300,
    READY: 400,
    DELIVERED: 500,
    CLOSED: 600,
};
const ORDER_LIST_INCLUDE = {
    customer: true,
    paymentMethod: true,
    status: true,
};
let SalesDocumentsService = class SalesDocumentsService {
    prisma;
    currencyConversion;
    orderFinance;
    constructor(prisma, currencyConversion, orderFinance) {
        this.prisma = prisma;
        this.currencyConversion = currencyConversion;
        this.orderFinance = orderFinance;
    }
    budgetStatusCache = new Map();
    disclaimerConfigKey = 'documentDisclaimerHtml';
    disclaimerCache = null;
    withDocumentType(documentType, where = {}) {
        return {
            ...where,
            documentType,
        };
    }
    async getBudgetStatusId(key) {
        if (this.budgetStatusCache.has(key)) {
            return this.budgetStatusCache.get(key);
        }
        const statusDef = BUDGET_STATUS[key];
        const status = await this.prisma.orderStatus.upsert({
            where: { code: statusDef.code },
            update: { name: statusDef.name, color: statusDef.color },
            create: { code: statusDef.code, name: statusDef.name, color: statusDef.color },
        });
        this.budgetStatusCache.set(key, status.id);
        return status.id;
    }
    decimalToString(value, scale = 2) {
        if (value === null || value === undefined) {
            return null;
        }
        const decimalValue = value instanceof client_1.Prisma.Decimal ? value : new client_1.Prisma.Decimal(value);
        return decimalValue.toFixed(scale);
    }
    formatSpecKey(key) {
        return key
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }
    buildSpecSummary(customAttributes) {
        if (!customAttributes || typeof customAttributes !== 'object' || Array.isArray(customAttributes)) {
            return null;
        }
        const entries = Object.entries(customAttributes)
            .filter(([, value]) => value !== undefined && value !== null && `${value}`.toString().trim().length)
            .map(([key, value]) => `${this.formatSpecKey(key)}: ${value}`);
        return entries.length ? entries.join(', ') : null;
    }
    computeDefaultValidity() {
        const now = new Date();
        const validity = new Date(now);
        validity.setDate(validity.getDate() + 30);
        return validity;
    }
    sanitizeDisclaimer(value) {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed.length) {
            return null;
        }
        const sanitized = (0, sanitize_1.sanitizeRichText)(trimmed, 'sales.orders.disclaimer');
        return sanitized.length ? sanitized : null;
    }
    async getDefaultDocumentDisclaimer() {
        const now = Date.now();
        if (this.disclaimerCache && this.disclaimerCache.expiresAt > now) {
            return this.disclaimerCache.value;
        }
        const record = await this.prisma.systemConfig.findUnique({
            where: { key: this.disclaimerConfigKey },
        });
        const value = typeof record?.value === 'string' && record.value.trim().length
            ? record.value
            : null;
        this.disclaimerCache = { value, expiresAt: now + 60 * 1000 };
        return value;
    }
    async resolveDocumentDisclaimer(value) {
        if (value === '') {
            return null;
        }
        const sanitized = this.sanitizeDisclaimer(value);
        if (sanitized) {
            return sanitized;
        }
        return (await this.getDefaultDocumentDisclaimer()) ?? null;
    }
    buildDocumentFileName(documentType, id, original) {
        const fallbackBase = `${documentType.toLowerCase()}-${id}`;
        if (typeof original !== 'string') {
            return `${fallbackBase}.pdf`;
        }
        const trimmed = original.trim();
        if (!trimmed.length) {
            return `${fallbackBase}.pdf`;
        }
        const parsed = (0, path_1.parse)(trimmed);
        const base = parsed.name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
        const safeBase = base.length ? base : fallbackBase;
        const ext = parsed.ext && parsed.ext.trim().length ? parsed.ext : '.pdf';
        const safeExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
        return `${safeBase}${safeExt}`;
    }
    normalizeCustomAttributes(attrs) {
        if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
            return null;
        }
        const result = {};
        for (const [key, value] of Object.entries(attrs)) {
            if (value === undefined || value === null) {
                continue;
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed.length)
                    continue;
                result[key] = trimmed;
            }
            else {
                result[key] = value;
            }
        }
        return Object.keys(result).length ? result : null;
    }
    coerceNumber(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.replace(',', '.').trim();
            if (!normalized.length) {
                return null;
            }
            const numeric = Number(normalized);
            return Number.isFinite(numeric) ? numeric : null;
        }
        return null;
    }
    readAttributeNumber(attrs, key) {
        if (!attrs) {
            return null;
        }
        const record = attrs;
        const variations = [key, key.toLowerCase(), key.toUpperCase()];
        for (const candidate of variations) {
            if (candidate in record) {
                const numeric = this.coerceNumber(record[candidate]);
                if (numeric !== null) {
                    return numeric;
                }
            }
        }
        return null;
    }
    computeMeasurementFactor(unit, attrs) {
        if (!unit) {
            return null;
        }
        if (unit === client_1.SalesUnit.UNIT) {
            return 1;
        }
        if (!attrs) {
            return null;
        }
        if (unit === client_1.SalesUnit.SQUARE_METER) {
            const width = this.readAttributeNumber(attrs, 'width');
            const height = this.readAttributeNumber(attrs, 'height');
            if (width === null || height === null) {
                return null;
            }
            const measurement = width * height;
            return Number.isFinite(measurement) && measurement > 0 ? measurement : null;
        }
        if (unit === client_1.SalesUnit.LINEAR_METER) {
            const length = this.readAttributeNumber(attrs, 'length');
            if (length === null) {
                return null;
            }
            return Number.isFinite(length) && length > 0 ? length : null;
        }
        return null;
    }
    resolveSalesUnit(value, fallback) {
        if (typeof value === 'string' && value.trim()) {
            const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
            for (const [unit, keywords] of Object.entries(SALES_UNIT_KEYWORDS)) {
                if (keywords.includes(normalized)) {
                    return unit;
                }
            }
            const upper = value.trim().toUpperCase();
            if (Object.values(client_1.SalesUnit).includes(upper)) {
                return upper;
            }
        }
        return fallback ?? null;
    }
    async getTaxRate() {
        const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'taxRate' } });
        const val = Number(cfg?.value ?? '22');
        return Number.isNaN(val) ? 22 : val;
    }
    serializeFxSnapshot(snapshot) {
        const rates = {};
        for (const [currency, rate] of Object.entries(snapshot.rates)) {
            rates[currency] = rate.toFixed(8);
        }
        return {
            base: snapshot.base,
            generatedAt: snapshot.generatedAt,
            rates,
        };
    }
    async getDefaultOrderStatus(preferredCode = ORDER_STATUS_CODES.PENDING) {
        const preferred = await this.prisma.orderStatus.findUnique({ where: { code: preferredCode } });
        if (preferred) {
            return preferred;
        }
        return this.prisma.orderStatus.findFirst({ orderBy: { code: 'asc' } });
    }
    async prepareOrderMonetaryData(dto, taxRate) {
        const requestedOrderCurrency = dto.orderCurrency
            ? this.currencyConversion.normalizeCurrency(dto.orderCurrency)
            : null;
        const normalizedOrderCurrency = requestedOrderCurrency ?? (await this.currencyConversion.getBaseCurrency());
        if (!normalizedOrderCurrency) {
            throw new common_1.BadRequestException('Invalid order currency');
        }
        const enabledCurrencies = await this.currencyConversion.getEnabledCurrencies();
        if (requestedOrderCurrency && !enabledCurrencies.includes(normalizedOrderCurrency)) {
            throw new common_1.BadRequestException('Order currency is not enabled in the system');
        }
        const orderCurrency = normalizedOrderCurrency;
        const productIds = dto.items
            .map((item) => Number(item.productId))
            .filter((id) => Number.isFinite(id) && id > 0);
        const products = productIds.length
            ? await this.prisma.product.findMany({
                where: { id: { in: productIds } },
                select: {
                    id: true,
                    currency: true,
                    salePrice: true,
                    costPrice: true,
                    name: true,
                    productCode: true,
                    unitOfMeasure: true,
                    specifications: true,
                },
            })
            : [];
        const productMap = new Map(products.map((product) => [product.id, product]));
        const requiredCurrencies = new Set([orderCurrency]);
        const itemMeta = dto.items.map((item) => {
            const numericProductId = Number(item.productId);
            const product = Number.isFinite(numericProductId) && numericProductId > 0
                ? productMap.get(numericProductId) ?? null
                : null;
            const customAttributes = this.normalizeCustomAttributes(item.customAttributes);
            const pricingMethod = this.resolveSalesUnit(item.pricingMethod, product?.unitOfMeasure ?? null);
            const measurement = this.computeMeasurementFactor(pricingMethod, customAttributes);
            const isMeasurementBased = pricingMethod === client_1.SalesUnit.SQUARE_METER || pricingMethod === client_1.SalesUnit.LINEAR_METER;
            const specSummary = this.buildSpecSummary(customAttributes);
            const providedCurrency = item.currency ? this.currencyConversion.normalizeCurrency(item.currency) : null;
            if (item.currency && !providedCurrency) {
                throw new common_1.BadRequestException(`Invalid currency provided for item "${item.name}"`);
            }
            const explicitUnitCurrencyRaw = item?.unitCurrency;
            const explicitUnitCurrency = explicitUnitCurrencyRaw
                ? this.currencyConversion.normalizeCurrency(explicitUnitCurrencyRaw)
                : null;
            if (explicitUnitCurrencyRaw && !explicitUnitCurrency) {
                throw new common_1.BadRequestException(`Invalid unit currency provided for item "${item.name}"`);
            }
            const productCurrency = product?.currency
                ? this.currencyConversion.normalizeCurrency(product.currency)
                : null;
            if (product?.currency && !productCurrency) {
                throw new common_1.BadRequestException(`Unsupported currency configured for product "${product.name}"`);
            }
            if (productCurrency) {
                requiredCurrencies.add(productCurrency);
            }
            const unitCurrency = explicitUnitCurrency ?? productCurrency ?? providedCurrency ?? orderCurrency;
            requiredCurrencies.add(unitCurrency);
            if (providedCurrency) {
                requiredCurrencies.add(providedCurrency);
            }
            const priceCurrency = providedCurrency ?? orderCurrency;
            requiredCurrencies.add(priceCurrency);
            const qtyRaw = Number(item.qty ?? 1);
            const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw) : 1;
            const priceValue = Number(item.price);
            const fallbackPrice = Number(product?.salePrice ?? 0);
            const rawPrice = Number.isFinite(priceValue) ? priceValue : fallbackPrice;
            const explicitUnitPriceValue = Number(item?.unitPrice);
            const explicitUnitAmount = Number.isFinite(explicitUnitPriceValue)
                ? (0, money_util_1.roundDecimal)(explicitUnitPriceValue, 4)
                : null;
            const unitCost = product?.costPrice ? (0, money_util_1.roundDecimal)(product.costPrice, 4) : null;
            const costCurrency = productCurrency ?? explicitUnitCurrency ?? providedCurrency ?? orderCurrency;
            if (unitCost && costCurrency) {
                requiredCurrencies.add(costCurrency);
            }
            return {
                item,
                product,
                priceCurrency,
                rawPrice,
                unitCurrency,
                qty,
                numericProductId,
                explicitUnitAmount,
                unitCost,
                costCurrency,
                customAttributes,
                pricingMethod,
                measurement,
                isMeasurementBased,
                specSummary,
            };
        });
        const snapshot = await this.currencyConversion.buildRatesSnapshot(Array.from(requiredCurrencies));
        let subTotal = (0, money_util_1.decimal)(0);
        const createItems = [];
        for (const meta of itemMeta) {
            const qtyDecimal = (0, money_util_1.decimal)(meta.qty);
            const hasMeasurement = meta.isMeasurementBased &&
                meta.measurement !== null &&
                meta.measurement !== undefined &&
                meta.measurement > 0;
            const measurementValue = hasMeasurement ? Number(meta.measurement) : 1;
            const measurementDecimal = (0, money_util_1.decimal)(measurementValue);
            let unitAmount;
            let unitAmountOrderCurrency;
            let conversionRate;
            let derivedUnitOrderCurrency;
            if (meta.explicitUnitAmount !== null && meta.explicitUnitAmount !== undefined) {
                unitAmount = (0, money_util_1.roundDecimal)(meta.explicitUnitAmount, 4);
                const unitConversion = this.currencyConversion.convertWithSnapshot(unitAmount, meta.unitCurrency, orderCurrency, snapshot, { amountScale: 4, rateScale: 8 });
                unitAmountOrderCurrency = (0, money_util_1.roundDecimal)(unitConversion.amount, 4);
                conversionRate = unitConversion.rate;
                derivedUnitOrderCurrency = hasMeasurement
                    ? (0, money_util_1.roundDecimal)((0, money_util_1.multiplyDecimals)(unitAmountOrderCurrency, measurementDecimal), 4)
                    : unitAmountOrderCurrency;
            }
            else {
                const priceDecimal = (0, money_util_1.roundDecimal)(meta.rawPrice, 4);
                const perInstanceConversion = this.currencyConversion.convertWithSnapshot(priceDecimal, meta.priceCurrency, orderCurrency, snapshot, { amountScale: 4, rateScale: 8 });
                derivedUnitOrderCurrency = (0, money_util_1.roundDecimal)(perInstanceConversion.amount, 4);
                conversionRate = perInstanceConversion.rate;
                unitAmountOrderCurrency = hasMeasurement
                    ? (0, money_util_1.roundDecimal)((0, money_util_1.divideDecimals)(derivedUnitOrderCurrency, measurementDecimal), 4)
                    : derivedUnitOrderCurrency;
                if (meta.priceCurrency === meta.unitCurrency) {
                    unitAmount = hasMeasurement
                        ? (0, money_util_1.roundDecimal)((0, money_util_1.divideDecimals)(priceDecimal, measurementDecimal), 4)
                        : priceDecimal;
                }
                else {
                    const perMeasurementBase = hasMeasurement
                        ? (0, money_util_1.roundDecimal)((0, money_util_1.divideDecimals)(priceDecimal, measurementDecimal), 4)
                        : priceDecimal;
                    const perUnitConversion = this.currencyConversion.convertWithSnapshot(perMeasurementBase, meta.priceCurrency, meta.unitCurrency, snapshot, { amountScale: 4, rateScale: 8 });
                    unitAmount = (0, money_util_1.roundDecimal)(perUnitConversion.amount, 4);
                }
            }
            const unitPriceRounded = (0, money_util_1.roundDecimal)(derivedUnitOrderCurrency, 2);
            const lineTotal = (0, money_util_1.roundDecimal)((0, money_util_1.multiplyDecimals)(unitPriceRounded, qtyDecimal), 2);
            subTotal = subTotal.plus(lineTotal);
            let unitCostOrderCurrency = null;
            if (meta.unitCost) {
                const costConversion = this.currencyConversion.convertWithSnapshot(meta.unitCost, meta.costCurrency, orderCurrency, snapshot, { amountScale: 4, rateScale: 8 });
                const costAmountOrderCurrency = (0, money_util_1.roundDecimal)(costConversion.amount, 4);
                unitCostOrderCurrency = hasMeasurement
                    ? (0, money_util_1.roundDecimal)((0, money_util_1.multiplyDecimals)(costAmountOrderCurrency, measurementDecimal), 4)
                    : costAmountOrderCurrency;
            }
            const unitPriceSnapshotDecimal = meta.explicitUnitAmount !== null && meta.explicitUnitAmount !== undefined
                ? (0, money_util_1.roundDecimal)(meta.explicitUnitAmount, 4)
                : unitAmount;
            const skuSnapshot = meta.product?.productCode ?? null;
            const nameSnapshot = meta.product?.name ?? meta.item.name;
            const comments = meta.item.comments?.trim?.() ? meta.item.comments.trim() : null;
            const customAttributesJson = meta.customAttributes;
            const specJson = meta.customAttributes;
            const itemData = {
                product: meta.product && meta.numericProductId
                    ? { connect: { id: meta.numericProductId } }
                    : undefined,
                name: meta.item.name,
                price: unitPriceRounded.toFixed(2),
                qty: meta.qty,
                img: meta.item.img ?? null,
                description: meta.item.description ?? null,
                comments,
                unitAmount: unitAmount.toFixed(4),
                unitCurrency: meta.unitCurrency,
                unitAmountOrderCurrency: unitAmountOrderCurrency.toFixed(4),
                conversionRate: conversionRate.toFixed(8),
                unitCostAmount: meta.unitCost ? meta.unitCost.toFixed(4) : undefined,
                unitCostCurrency: meta.unitCost ? meta.costCurrency : undefined,
                unitCostOrderCurrency: unitCostOrderCurrency ? unitCostOrderCurrency.toFixed(4) : undefined,
                customAttributes: customAttributesJson,
                pricingMethodSnapshot: meta.pricingMethod ?? undefined,
                unitPriceSnapshot: unitPriceSnapshotDecimal.toFixed(4),
                skuSnapshot: skuSnapshot ?? undefined,
                nameSnapshot: nameSnapshot ?? undefined,
                specSummary: meta.specSummary ?? undefined,
                specJson,
            };
            createItems.push(itemData);
        }
        if (!createItems.length) {
            throw new common_1.BadRequestException('Order items are invalid or empty');
        }
        const delivery = (0, money_util_1.roundDecimal)(dto.shipping?.deliveryFees ?? 0, 2);
        const taxRateDecimal = (0, money_util_1.decimal)(taxRate);
        const taxFraction = (0, money_util_1.divideDecimals)(taxRateDecimal, (0, money_util_1.addDecimals)((0, money_util_1.decimal)(100), taxRateDecimal));
        const tax = (0, money_util_1.roundDecimal)((0, money_util_1.multiplyDecimals)(subTotal, taxFraction), 2);
        const grandTotal = (0, money_util_1.roundDecimal)((0, money_util_1.addDecimals)(subTotal, delivery), 2);
        return {
            orderCurrency,
            snapshot,
            items: createItems,
            subTotal,
            tax,
            grandTotal,
            delivery,
        };
    }
    resolveScalarParam(raw) {
        if (Array.isArray(raw)) {
            for (const item of raw) {
                if (typeof item === 'string' || typeof item === 'number') {
                    return String(item);
                }
            }
            return '';
        }
        if (typeof raw === 'string' || typeof raw === 'number') {
            return String(raw);
        }
        return '';
    }
    normalizeOrderDirection(value) {
        const normalized = value?.toLowerCase?.() || '';
        if (normalized === 'asc' || normalized === 'ascending' || normalized === 'ascend') {
            return 'asc';
        }
        if (normalized === 'desc' || normalized === 'descending' || normalized === 'descend') {
            return 'desc';
        }
        return undefined;
    }
    normalizeOrderSortKey(key) {
        const normalized = key?.toString?.().trim();
        if (!normalized)
            return undefined;
        if (['id', 'date', 'customer', 'status', 'statusId', 'paymentMehod', 'totalAmount', 'validUntilDate'].includes(normalized)) {
            return normalized;
        }
        return undefined;
    }
    parseSortObject(raw) {
        if (!raw)
            return undefined;
        if (typeof raw === 'object')
            return raw;
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : undefined;
            }
            catch {
                return undefined;
            }
        }
        return undefined;
    }
    extractOrderSort(q) {
        let sortObj = this.parseSortObject(q?.sort);
        if (!sortObj) {
            const nestedKey = q?.['sort[key]'] ?? q?.['sort.key'];
            const nestedOrder = q?.['sort[order]'] ?? q?.['sort.order'];
            if (nestedKey !== undefined || nestedOrder !== undefined) {
                sortObj = { key: nestedKey, order: nestedOrder };
            }
        }
        if (!sortObj) {
            if (q?.sortKey !== undefined || q?.sortOrder !== undefined) {
                sortObj = { key: q?.sortKey, order: q?.sortOrder };
            }
        }
        const sortKeyRaw = this.resolveScalarParam(sortObj?.key);
        const sortOrderRaw = this.resolveScalarParam(sortObj?.order);
        const key = this.normalizeOrderSortKey(sortKeyRaw);
        const order = this.normalizeOrderDirection(sortOrderRaw);
        if (!key || !order)
            return undefined;
        return { key, order };
    }
    buildOrderOrderBy(sort) {
        const orderBy = [];
        if (sort) {
            switch (sort.key) {
                case 'id':
                    orderBy.push({ id: sort.order });
                    break;
                case 'date':
                    orderBy.push({ date: sort.order });
                    break;
                case 'validUntilDate':
                    orderBy.push({ validUntil: sort.order });
                    break;
                case 'customer':
                    orderBy.push({ customer: { name: sort.order } });
                    break;
                case 'status':
                    orderBy.push({ status: { name: sort.order } });
                    break;
                case 'statusId':
                    orderBy.push({ statusId: sort.order });
                    break;
                case 'paymentMehod':
                    orderBy.push({ paymentMethod: { name: sort.order } });
                    break;
                case 'totalAmount':
                    orderBy.push({ grandTotal: sort.order });
                    break;
            }
        }
        if (!orderBy.length) {
            orderBy.push({ id: 'desc' });
        }
        else if (sort?.key !== 'id') {
            orderBy.push({ id: 'desc' });
        }
        return orderBy;
    }
    buildOrderSearchWhere(raw) {
        const queryValue = this.resolveScalarParam(raw).trim();
        if (!queryValue)
            return undefined;
        const terms = queryValue.split(/\s+/).map((term) => term.trim()).filter(Boolean);
        if (!terms.length)
            return undefined;
        const andConditions = terms.map((term) => {
            const sanitizedTerm = term.replace(/^#/, '');
            const digitsOnly = sanitizedTerm.replace(/[^\d]/g, '');
            const numericId = digitsOnly ? Number(digitsOnly) : undefined;
            const orConditions = [
                { customer: { name: { contains: term, mode: 'insensitive' } } },
                { customer: { email: { contains: term, mode: 'insensitive' } } },
                { customer: { phoneNumber: { contains: term, mode: 'insensitive' } } },
                { paymentMethod: { name: { contains: term, mode: 'insensitive' } } },
                { status: { name: { contains: term, mode: 'insensitive' } } },
                { shippingAddress1: { contains: term, mode: 'insensitive' } },
                { shippingAddress2: { contains: term, mode: 'insensitive' } },
                { shippingCity: { contains: term, mode: 'insensitive' } },
                { shippingState: { contains: term, mode: 'insensitive' } },
            ];
            if (numericId && Number.isFinite(numericId)) {
                orConditions.push({ id: numericId });
            }
            return { OR: orConditions };
        });
        return { AND: andConditions };
    }
    buildCsv(rows) {
        return rows
            .map((row) => row
            .map((value) => {
            if (value === null || value === undefined) {
                return '';
            }
            const str = String(value);
            if (str.includes('"') || str.includes(',') || /\s/.test(str)) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        })
            .join(','))
            .join('\n');
    }
    parseCsv(content) {
        const rows = [];
        let currentRow = [];
        let currentValue = '';
        let inQuotes = false;
        const pushValue = () => {
            currentRow.push(currentValue);
            currentValue = '';
        };
        for (let i = 0; i < content.length; i += 1) {
            const char = content[i];
            const nextChar = content[i + 1];
            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    currentValue += '"';
                    i += 1;
                    continue;
                }
                if (char === '"') {
                    inQuotes = false;
                    continue;
                }
                currentValue += char;
            }
            else {
                if (char === '"') {
                    inQuotes = true;
                }
                else if (char === ',') {
                    pushValue();
                }
                else if (char === '\n') {
                    pushValue();
                    rows.push(currentRow);
                    currentRow = [];
                }
                else if (char === '\r') {
                    continue;
                }
                else {
                    currentValue += char;
                }
            }
        }
        pushValue();
        if (currentRow.length) {
            rows.push(currentRow);
        }
        return rows;
    }
    normalizeHeaderKey(key) {
        if (!key)
            return '';
        return String(key).trim().toLowerCase().replace(/\s+/g, '');
    }
    getCell(row, columnIndex, key, aliases = []) {
        const normalizedKey = this.normalizeHeaderKey(key);
        const candidates = [normalizedKey, ...aliases.map((alias) => this.normalizeHeaderKey(alias))];
        for (const candidate of candidates) {
            if (!candidate)
                continue;
            if (columnIndex.has(candidate)) {
                const idx = columnIndex.get(candidate);
                return row[idx] ?? '';
            }
        }
        return '';
    }
    parseNumber(value) {
        if (value === undefined || value === null || value === '')
            return 0;
        const num = Number(value);
        return Number.isNaN(num) ? 0 : num;
    }
    parseDate(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }
    async resolveCustomer(email, name, phone, cache) {
        const cached = cache.get(email);
        if (cached)
            return cached;
        const existing = await this.prisma.customer.findUnique({ where: { email } });
        if (existing) {
            cache.set(email, { id: existing.id });
            return { id: existing.id };
        }
        const created = await this.prisma.customer.create({
            data: {
                email,
                name,
                phoneNumber: phone || null,
            },
            select: { id: true },
        });
        cache.set(email, created);
        return created;
    }
    async resolvePaymentMethod(name, cache) {
        const normalized = name.trim().toLowerCase();
        if (cache.has(normalized)) {
            return cache.get(normalized);
        }
        const existing = await this.prisma.paymentMethod.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) {
            cache.set(normalized, existing.id);
            return existing.id;
        }
        const created = await this.prisma.paymentMethod.create({ data: { name } });
        cache.set(normalized, created.id);
        return created.id;
    }
    async resolveStatus(row, columnIndex, statusById, statusByName, defaultStatusId) {
        const rawStatusId = this.getCell(row, columnIndex, 'statusId', ['status']);
        const rawStatusName = this.getCell(row, columnIndex, 'statusName');
        if (rawStatusId) {
            const numericStatus = rawStatusId ? Math.round(this.parseNumber(rawStatusId)) : 0;
            if (numericStatus && statusById.has(numericStatus)) {
                return statusById.get(numericStatus);
            }
            if (numericStatus) {
                const existing = await this.prisma.orderStatus.findUnique({ where: { code: numericStatus } });
                if (existing) {
                    statusById.set(numericStatus, existing.id);
                    statusByName.set(existing.name.toLowerCase(), existing.id);
                    return existing.id;
                }
            }
        }
        if (rawStatusName) {
            const nameKey = rawStatusName.trim().toLowerCase();
            if (statusByName.has(nameKey)) {
                return statusByName.get(nameKey);
            }
            const existing = await this.prisma.orderStatus.findFirst({
                where: { name: { equals: rawStatusName, mode: 'insensitive' } },
            });
            if (existing) {
                statusByName.set(nameKey, existing.id);
                statusById.set(existing.code, existing.id);
                return existing.id;
            }
        }
        return defaultStatusId ?? null;
    }
    async listDocuments(documentType, q) {
        const pageIndexRaw = Number(q.pageIndex);
        const pageSizeRaw = Number(q.pageSize);
        const pageIndex = Number.isFinite(pageIndexRaw) && pageIndexRaw > 0 ? Math.floor(pageIndexRaw) : 1;
        const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 50;
        const where = this.withDocumentType(documentType, this.buildOrderSearchWhere(q.query) ?? {});
        const total = await this.prisma.order.count({ where });
        const sort = this.extractOrderSort(q);
        const orderBy = this.buildOrderOrderBy(sort);
        const orders = await this.prisma.order.findMany({
            where,
            orderBy,
            skip: (pageIndex - 1) * pageSize,
            take: pageSize,
            include: ORDER_LIST_INCLUDE,
        });
        const defaultStatus = documentType === client_1.DocumentType.BUDGET
            ? await this.prisma.orderStatus.findUnique({ where: { code: BUDGET_STATUS.DRAFT.code } })
            : await this.getDefaultOrderStatus();
        const data = orders.map((o) => {
            const validity = o.validUntil ? new Date(o.validUntil).toISOString() : null;
            return {
                id: String(o.id),
                date: Math.floor(new Date(o.date).getTime() / 1000),
                validUntilDate: validity,
                validityDate: validity,
                customer: o.customer?.name || '',
                status: (o.statusId ?? defaultStatus?.id) || 0,
                paymentMehod: o.paymentMethod?.name || '',
                paymentIdendifier: '',
                totalAmount: Number(o.grandTotal?.toString?.() ?? o.grandTotal ?? 0),
                orderCurrency: o.orderCurrency,
            };
        });
        return { data, total };
    }
    async exportDocuments(documentType, q) {
        const where = this.withDocumentType(documentType, this.buildOrderSearchWhere(q.query) ?? {});
        const sort = this.extractOrderSort(q);
        const orderBy = this.buildOrderOrderBy(sort);
        const orders = await this.prisma.order.findMany({
            where,
            orderBy,
            include: ORDER_LIST_INCLUDE,
        });
        const defaultStatus = documentType === client_1.DocumentType.BUDGET
            ? await this.prisma.orderStatus.findUnique({ where: { code: BUDGET_STATUS.DRAFT.code } })
            : await this.getDefaultOrderStatus();
        const header = [
            'id',
            'date',
            'customer',
            'customerEmail',
            'customerPhone',
            'statusId',
            'statusName',
            'paymentMethod',
            'grandTotal',
            'orderCurrency',
            'fxBase',
            'fxRates',
            'subTotal',
            'tax',
            'deliveryFees',
            'shippingCity',
            'shippingState',
            'shippingVendor',
            'billingCity',
            'billingState',
            'comment',
            'createdAt',
            'updatedAt',
        ];
        const dataRows = orders.map((order) => {
            const statusId = (order.statusId ?? defaultStatus?.id) ?? '';
            const statusName = order.status?.name ?? defaultStatus?.name ?? '';
            return [
                order.id,
                order.date instanceof Date ? order.date.toISOString() : new Date(order.date).toISOString(),
                order.customer?.name ?? '',
                order.customer?.email ?? '',
                order.customer?.phoneNumber ?? '',
                statusId,
                statusName,
                order.paymentMethod?.name ?? '',
                order.grandTotal !== null && order.grandTotal !== undefined ? order.grandTotal.toFixed(2) : '',
                order.orderCurrency ?? '',
                order.fxBase ?? '',
                order.fxRates ? JSON.stringify(order.fxRates) : '',
                order.subTotal !== null && order.subTotal !== undefined ? order.subTotal.toFixed(2) : '',
                order.tax !== null && order.tax !== undefined ? order.tax.toFixed(2) : '',
                order.deliveryFees !== null && order.deliveryFees !== undefined ? order.deliveryFees.toFixed(2) : '',
                order.shippingCity ?? '',
                order.shippingState ?? '',
                order.shippingVendor ?? '',
                order.billingCity ?? '',
                order.billingState ?? '',
                order.comment ?? '',
                order.createdAt instanceof Date ? order.createdAt.toISOString() : new Date(order.createdAt).toISOString(),
                order.updatedAt instanceof Date ? order.updatedAt.toISOString() : new Date(order.updatedAt).toISOString(),
            ];
        });
        const csv = this.buildCsv([header, ...dataRows]);
        const filename = `orders-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        return new common_1.StreamableFile(Buffer.from(csv, 'utf8'), {
            type: 'text/csv; charset=utf-8',
            disposition: `attachment; filename="${filename}"`,
        });
    }
    async importDocuments(documentType, req) {
        const file = await req?.file?.();
        if (!file)
            throw new common_1.BadRequestException('sales.orders.import.fileRequired');
        const buffer = await file.toBuffer();
        if (!buffer || buffer.length === 0)
            throw new common_1.BadRequestException('sales.orders.import.emptyFile');
        const rows = this.parseCsv(buffer.toString('utf8'));
        if (!rows.length)
            throw new common_1.BadRequestException('sales.orders.import.emptyFile');
        const header = rows.shift() ?? [];
        const columnIndex = new Map();
        header.forEach((col, idx) => {
            const normalized = this.normalizeHeaderKey(col);
            if (normalized)
                columnIndex.set(normalized, idx);
        });
        const requiredColumns = ['customerEmail', 'grandTotal'];
        const missingColumns = requiredColumns.filter((col) => !columnIndex.has(this.normalizeHeaderKey(col)));
        if (missingColumns.length) {
            throw new common_1.BadRequestException(`Missing required columns: ${missingColumns.join(', ')}`);
        }
        const defaultStatus = await this.getDefaultOrderStatus();
        const statusById = new Map();
        const statusByName = new Map();
        if (defaultStatus?.id) {
            statusById.set(defaultStatus.id, defaultStatus.id);
            if (defaultStatus.name)
                statusByName.set(defaultStatus.name.toLowerCase(), defaultStatus.id);
        }
        const paymentCache = new Map();
        const customerCache = new Map();
        const errors = [];
        let imported = 0;
        const enabledCurrencies = await this.currencyConversion.getEnabledCurrencies();
        const baseCurrency = await this.currencyConversion.getBaseCurrency();
        const defaultOrderCurrency = this.currencyConversion.normalizeCurrency(enabledCurrencies[0]) ?? baseCurrency;
        const baseRates = await this.currencyConversion.listRates(baseCurrency);
        const defaultFxRates = {
            base: baseCurrency,
            generatedAt: new Date().toISOString(),
            rates: baseRates.reduce((acc, rate) => {
                acc[rate.quote] = new client_1.Prisma.Decimal(rate.rate).toFixed(8);
                return acc;
            }, { [baseCurrency]: '1' }),
        };
        const cloneDefaultFxRates = () => JSON.parse(JSON.stringify(defaultFxRates));
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const lineNumber = i + 2;
            try {
                const rawId = this.getCell(row, columnIndex, 'id');
                if (rawId) {
                    const numericId = Math.round(this.parseNumber(rawId));
                    if (numericId > 0) {
                        const exists = await this.prisma.order.findFirst({
                            where: { id: numericId, documentType },
                        });
                        if (exists) {
                            errors.push({ row: lineNumber, message: `Order with id ${numericId} already exists` });
                            continue;
                        }
                    }
                }
                const email = this.getCell(row, columnIndex, 'customerEmail');
                if (!email)
                    throw new Error('customerEmail is required');
                const name = this.getCell(row, columnIndex, 'customer') || email;
                const phone = this.getCell(row, columnIndex, 'customerPhone');
                const customer = await this.resolveCustomer(email, name, phone, customerCache);
                const paymentName = this.getCell(row, columnIndex, 'paymentMethod', ['paymentMehod']);
                const paymentMethodId = await this.resolvePaymentMethod(paymentName || 'Cash', paymentCache);
                const statusId = await this.resolveStatus(row, columnIndex, statusById, statusByName, defaultStatus?.id);
                const date = this.parseDate(this.getCell(row, columnIndex, 'date')) || new Date();
                const createdAt = this.parseDate(this.getCell(row, columnIndex, 'createdAt'));
                const shippingCity = this.getCell(row, columnIndex, 'shippingCity');
                const shippingState = this.getCell(row, columnIndex, 'shippingState');
                const shippingVendor = this.getCell(row, columnIndex, 'shippingVendor');
                const billingCity = this.getCell(row, columnIndex, 'billingCity');
                const billingState = this.getCell(row, columnIndex, 'billingState');
                const comment = this.getCell(row, columnIndex, 'comment');
                const grandTotal = this.parseNumber(this.getCell(row, columnIndex, 'grandTotal'));
                const subTotalCell = this.getCell(row, columnIndex, 'subTotal');
                const subTotal = subTotalCell ? this.parseNumber(subTotalCell) : grandTotal;
                const tax = this.parseNumber(this.getCell(row, columnIndex, 'tax'));
                const deliveryFees = this.parseNumber(this.getCell(row, columnIndex, 'deliveryFees'));
                const orderCurrencyRaw = this.getCell(row, columnIndex, 'orderCurrency');
                const orderCurrency = this.currencyConversion.normalizeCurrency(orderCurrencyRaw) ?? defaultOrderCurrency;
                const fxBaseRaw = this.getCell(row, columnIndex, 'fxBase');
                const fxBase = this.currencyConversion.normalizeCurrency(fxBaseRaw) ?? defaultFxRates.base;
                const fxRatesCell = this.getCell(row, columnIndex, 'fxRates');
                let fxRates = cloneDefaultFxRates();
                if (fxRatesCell) {
                    try {
                        const parsed = JSON.parse(fxRatesCell);
                        if (parsed && typeof parsed === 'object') {
                            fxRates = parsed;
                        }
                    }
                    catch {
                        fxRates = cloneDefaultFxRates();
                    }
                }
                if (!fxRates || typeof fxRates !== 'object') {
                    fxRates = cloneDefaultFxRates();
                }
                fxRates.base = fxBase;
                if (!fxRates.rates || typeof fxRates.rates !== 'object') {
                    fxRates.rates = { [fxBase]: '1' };
                }
                else if (!fxRates.rates[fxBase]) {
                    fxRates.rates[fxBase] = '1';
                }
                await this.prisma.order.create({
                    data: {
                        documentType,
                        customerId: customer.id,
                        date,
                        createdAt: createdAt ?? undefined,
                        updatedAt: createdAt ?? undefined,
                        statusId,
                        paymentMethodId,
                        shippingCity: shippingCity || null,
                        shippingState: shippingState || null,
                        shippingVendor: shippingVendor || null,
                        billingCity: billingCity || null,
                        billingState: billingState || null,
                        comment: comment || null,
                        grandTotal,
                        subTotal,
                        tax,
                        deliveryFees,
                        orderCurrency,
                        fxBase,
                        fxRates,
                    },
                });
                imported += 1;
            }
            catch (error) {
                errors.push({ row: lineNumber, message: error?.message || 'Unknown error' });
            }
        }
        return { imported, errors };
    }
    async deleteDocuments(documentType, idPayload) {
        const ids = Array.isArray(idPayload.id) ? idPayload.id : [idPayload.id];
        const numericIds = ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
        if (!numericIds.length) {
            throw new common_1.BadRequestException('sales.orders.validation.invalidIds');
        }
        const documents = await this.prisma.order.findMany({
            where: { id: { in: numericIds }, documentType },
            select: { documentFilePath: true },
        });
        await this.prisma.order.deleteMany({ where: { id: { in: numericIds }, documentType } });
        await Promise.all(documents.map((doc) => (0, documents_1.deleteSalesDocumentFile)(doc.documentFilePath)));
        return true;
    }
    async getDocumentDetails(documentType, id) {
        const order = await this.prisma.order.findFirst({
            where: { id, documentType },
            include: {
                customer: {
                    include: {
                        addresses: {
                            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                        },
                    },
                },
                items: { include: { product: true } },
                paymentMethod: true,
                status: true,
                payments: {
                    include: {
                        paymentMethod: true,
                        attachments: {
                            select: {
                                id: true,
                                name: true,
                                mimeType: true,
                                size: true,
                                createdAt: true,
                            },
                        },
                    },
                    orderBy: { date: 'asc' },
                },
            },
        });
        if (!order)
            return null;
        const customerAddresses = order.customer?.addresses ?? [];
        const primaryAddress = customerAddresses.find((addr) => addr.isPrimary) ?? customerAddresses[0] ?? null;
        const secondaryAddress = customerAddresses.find((addr) => !addr.isPrimary && addr.id !== primaryAddress?.id) ?? null;
        const normalizeString = (value) => {
            if (typeof value !== 'string') {
                return null;
            }
            const trimmed = value.trim();
            return trimmed.length ? trimmed : null;
        };
        const formatLine1 = (addr) => {
            if (!addr) {
                return null;
            }
            const line = [normalizeString(addr.street), normalizeString(addr.number)]
                .filter((segment) => Boolean(segment))
                .join(' ');
            return line.length ? line : null;
        };
        const formatLine2 = (addr) => {
            if (!addr) {
                return null;
            }
            const apartment = normalizeString(addr.apartment);
            const corner = normalizeString(addr.corner);
            const parts = [
                apartment ? `Apt ${apartment}` : null,
                corner,
            ].filter((segment) => Boolean(segment));
            if (!parts.length) {
                return null;
            }
            return parts.join(' • ');
        };
        const shippingAddressSource = primaryAddress;
        const billingAddressSource = secondaryAddress ?? primaryAddress;
        const shippingAddress1 = normalizeString(order.shippingAddress1) ?? formatLine1(shippingAddressSource);
        const shippingAddress2 = normalizeString(order.shippingAddress2) ?? formatLine2(shippingAddressSource);
        const shippingCity = normalizeString(order.shippingCity) ?? normalizeString(shippingAddressSource?.city);
        const shippingState = normalizeString(order.shippingState) ?? normalizeString(shippingAddressSource?.country);
        const billingAddress1 = normalizeString(order.billingAddress1) ?? formatLine1(billingAddressSource);
        const billingAddress2 = normalizeString(order.billingAddress2) ?? formatLine2(billingAddressSource);
        const billingCity = normalizeString(order.billingCity) ?? normalizeString(billingAddressSource?.city);
        const billingState = normalizeString(order.billingState) ?? normalizeString(billingAddressSource?.country);
        const [previousOrdersCount, previousBudgetsCount] = await Promise.all([
            this.prisma.order.count({
                where: {
                    customerId: order.customerId,
                    id: { not: order.id },
                    documentType: client_1.DocumentType.ORDER,
                },
            }),
            this.prisma.order.count({
                where: {
                    customerId: order.customerId,
                    documentType: client_1.DocumentType.BUDGET,
                    ...(order.documentType === client_1.DocumentType.BUDGET
                        ? { id: { not: order.id } }
                        : {}),
                },
            }),
        ]);
        const customer = order.customer
            ? (() => {
                const { addresses: _addresses, ...rest } = order.customer;
                return {
                    ...rest,
                    previousOrder: previousOrdersCount,
                    previousBudgets: previousBudgetsCount,
                };
            })()
            : null;
        const disclaimer = order.disclaimer ?? (await this.getDefaultDocumentDisclaimer()) ?? null;
        const validity = order.validUntil ? order.validUntil.toISOString() : null;
        let paymentSummary = null;
        try {
            paymentSummary = await this.orderFinance.getOrderPaymentSummary(order.id);
        }
        catch (error) {
            paymentSummary = null;
        }
        return {
            id: order.id,
            date: order.date,
            validUntilDate: validity,
            validityDate: validity,
            customer,
            items: order.items.map((item) => ({
                ...item,
                price: Number(item.price?.toString?.() ?? item.price ?? 0),
                unitAmount: item.unitAmount ? Number(item.unitAmount.toString()) : null,
                unitAmountOrderCurrency: item.unitAmountOrderCurrency
                    ? Number(item.unitAmountOrderCurrency.toString())
                    : null,
                conversionRate: item.conversionRate ? Number(item.conversionRate.toString()) : null,
                unitCostAmount: item.unitCostAmount ? Number(item.unitCostAmount.toString()) : null,
                unitCostOrderCurrency: item.unitCostOrderCurrency
                    ? Number(item.unitCostOrderCurrency.toString())
                    : null,
                unitCurrency: item.unitCurrency ?? null,
                unitCostCurrency: item.unitCostCurrency ?? null,
                comments: item.comments ?? null,
            })),
            paymentMethod: order.paymentMethod,
            status: order.status,
            subTotal: Number(order.subTotal?.toString?.() ?? order.subTotal ?? 0),
            tax: Number(order.tax?.toString?.() ?? order.tax ?? 0),
            deliveryFees: order.deliveryFees === null ? null : Number(order.deliveryFees.toString()),
            grandTotal: Number(order.grandTotal?.toString?.() ?? order.grandTotal ?? 0),
            documentFilePath: order.documentFilePath ?? null,
            documentFileName: order.documentFileName ?? null,
            documentFileMime: order.documentFileMime ?? null,
            documentFileSize: order.documentFileSize ?? null,
            documentGeneratedAt: order.documentGeneratedAt ?? null,
            orderCurrency: order.orderCurrency,
            fxBase: order.fxBase,
            fxRates: order.fxRates,
            comment: order.comment,
            billingSameAsShipping: order.billingSameAsShipping,
            shippingAddress1: shippingAddress1 ?? null,
            shippingAddress2: shippingAddress2 ?? null,
            shippingCity: shippingCity ?? null,
            shippingState: shippingState ?? null,
            shippingZip: normalizeString(order.shippingZip),
            billingAddress1: billingAddress1 ?? null,
            billingAddress2: billingAddress2 ?? null,
            billingCity: billingCity ?? null,
            billingState: billingState ?? null,
            billingZip: normalizeString(order.billingZip),
            shippingVendor: order.shippingVendor ?? null,
            estimatedMin: order.estimatedMin ?? null,
            estimatedMax: order.estimatedMax ?? null,
            disclaimer,
            minimumDepositType: order.minimumDepositType,
            minimumDepositValue: Number(order.minimumDepositValue?.toString?.() ?? order.minimumDepositValue ?? 0),
            customerCredit: Number(order.customerCredit?.toString?.() ?? order.customerCredit ?? 0),
            confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
            depositSatisfiedAt: order.depositSatisfiedAt ? order.depositSatisfiedAt.toISOString() : null,
            payments: {
                summary: paymentSummary
                    ? {
                        currency: paymentSummary.currency,
                        depositRequired: Number(paymentSummary.depositRequired.toString()),
                        depositPaidConfirmed: Number(paymentSummary.depositPaidConfirmed.toString()),
                        balancePaidConfirmed: Number(paymentSummary.balancePaidConfirmed.toString()),
                        refundsConfirmed: Number(paymentSummary.refundsConfirmed.toString()),
                        totalPaidConfirmed: Number(paymentSummary.totalPaidConfirmed.toString()),
                        depositPending: Number(paymentSummary.depositPending.toString()),
                        balancePending: Number(paymentSummary.balancePending.toString()),
                        refundsPending: Number(paymentSummary.refundsPending.toString()),
                        outstanding: Number(paymentSummary.outstanding.toString()),
                        customerCredit: Number(paymentSummary.customerCredit.toString()),
                        depositMet: paymentSummary.depositMet,
                    }
                    : null,
                records: order.payments.map((payment) => ({
                    id: payment.id,
                    orderId: payment.orderId,
                    amount: Number(payment.amount.toString()),
                    currency: payment.currency,
                    type: payment.type,
                    status: payment.status,
                    reference: payment.reference ?? null,
                    method: payment.method ?? payment.paymentMethod?.name ?? null,
                    paymentMethodId: payment.paymentMethodId ?? null,
                    date: payment.date.toISOString(),
                    notes: payment.notes ?? null,
                    createdAt: payment.createdAt.toISOString(),
                    updatedAt: payment.updatedAt.toISOString(),
                    attachments: payment.attachments.map((attachment) => ({
                        id: attachment.id,
                        name: attachment.name,
                        type: attachment.mimeType ?? null,
                        size: attachment.size ?? null,
                        createdAt: attachment.createdAt.toISOString(),
                        url: `/accounting/payments/${payment.id}/attachments/${attachment.id}`,
                    })),
                })),
            },
        };
    }
    async getDocumentPdf(documentType, id) {
        const order = await this.prisma.order.findFirst({
            where: { id, documentType },
            select: {
                documentFilePath: true,
                documentFileName: true,
                documentFileMime: true,
                documentFileSize: true,
                documentPdf: true,
            },
        });
        if (!order) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        const fileName = this.buildDocumentFileName(documentType, id, order.documentFileName);
        const mime = order.documentFileMime ?? 'application/pdf';
        if (order.documentPdf) {
            const buffer = Buffer.isBuffer(order.documentPdf)
                ? order.documentPdf
                : Buffer.from(order.documentPdf);
            return new common_1.StreamableFile(buffer, {
                type: mime,
                disposition: `inline; filename="${fileName}"`,
                length: buffer.length,
            });
        }
        const localPath = (0, documents_1.resolveSalesDocumentLocalPath)(order.documentFilePath);
        if (localPath) {
            try {
                const stats = await (0, promises_1.stat)(localPath);
                const stream = (0, fs_1.createReadStream)(localPath);
                return new common_1.StreamableFile(stream, {
                    type: mime,
                    disposition: `inline; filename="${fileName}"`,
                    length: stats?.size ?? order.documentFileSize ?? undefined,
                });
            }
            catch (error) {
                if (error?.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        throw new common_1.BadRequestException('sales.orders.validation.notFound');
    }
    async createDocument(documentType, dto) {
        const customerId = Number(dto.customerId);
        if (!customerId)
            throw new common_1.BadRequestException('sales.orders.validation.customerRequired');
        if (!Array.isArray(dto.items) || dto.items.length === 0)
            throw new common_1.BadRequestException('sales.orders.validation.itemsRequired');
        const taxRate = await this.getTaxRate();
        const monetary = await this.prepareOrderMonetaryData(dto, taxRate);
        const completedStatus = await this.getDefaultOrderStatus(ORDER_STATUS_CODES.PENDING);
        const disclaimer = await this.resolveDocumentDisclaimer(dto.disclaimer);
        const depositRequirement = await this.orderFinance.resolveDepositRequirement({
            type: dto.minimumDepositType ?? null,
            value: dto.minimumDepositValue ?? null,
        });
        const composeAddress = (addr) => {
            if (!addr)
                return undefined;
            const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim();
            const line2 = addr.addressLine2 || (addr.corner ? `Esquina: ${addr.corner}` : '');
            return line1 && addr.city && addr.state
                ? { addressLine1: line1, addressLine2: line2, city: addr.city, state: addr.state }
                : undefined;
        };
        let paymentMethodId = null;
        if (dto.paymentMehod) {
            const maybeId = Number(dto.paymentMehod);
            if (!Number.isNaN(maybeId) && maybeId > 0) {
                const pm = await this.prisma.paymentMethod.findUnique({ where: { id: maybeId } });
                if (pm) {
                    paymentMethodId = pm.id;
                }
            }
            if (paymentMethodId === null) {
                const name = String(dto.paymentMehod).trim();
                if (name) {
                    const pm = await this.prisma.paymentMethod.upsert({
                        where: { name },
                        update: {},
                        create: { name },
                    });
                    paymentMethodId = pm.id;
                }
            }
        }
        let shippingAddress = composeAddress(dto.shippingAddress);
        if (!shippingAddress) {
            const primaryAddr = await this.prisma.customerAddress.findFirst({ where: { customerId, isPrimary: true } });
            if (!primaryAddr)
                throw new common_1.BadRequestException('sales.orders.validation.customerAddressRequired');
            shippingAddress = {
                addressLine1: `${primaryAddr.street} ${primaryAddr.number}${primaryAddr.apartment ? ' Apt ' + primaryAddr.apartment : ''}`,
                addressLine2: primaryAddr.corner ? `Esquina: ${primaryAddr.corner}` : '',
                city: primaryAddr.city,
                state: primaryAddr.country,
            };
        }
        const rawValidUntil = dto.validUntil ?? dto.validUntilDate ?? null;
        const created = await this.prisma.order.create({
            data: {
                documentType,
                customerId,
                date: dto.date ? new Date(dto.date) : new Date(),
                shippingAddress1: shippingAddress.addressLine1,
                shippingAddress2: shippingAddress.addressLine2,
                shippingCity: shippingAddress.city,
                shippingState: shippingAddress.state,
                ...(dto.billingSameAsShipping
                    ? {
                        billingAddress1: shippingAddress.addressLine1,
                        billingAddress2: shippingAddress.addressLine2,
                        billingCity: shippingAddress.city,
                        billingState: shippingAddress.state,
                    }
                    : (() => {
                        const b = composeAddress(dto.billingAddress);
                        return b
                            ? {
                                billingAddress1: b.addressLine1,
                                billingAddress2: b.addressLine2,
                                billingCity: b.city,
                                billingState: b.state,
                            }
                            : {};
                    })()),
                billingSameAsShipping: dto.billingSameAsShipping,
                shippingVendor: dto.shipping?.shippingVendor,
                statusId: completedStatus?.id,
                paymentMethodId,
                deliveryFees: monetary.delivery.toFixed(2),
                estimatedMin: dto.shipping?.estimatedMin,
                estimatedMax: dto.shipping?.estimatedMax,
                comment: dto.comment,
                subTotal: monetary.subTotal.toFixed(2),
                tax: monetary.tax.toFixed(2),
                grandTotal: monetary.grandTotal.toFixed(2),
                minimumDepositType: depositRequirement.type,
                minimumDepositValue: depositRequirement.value.toFixed(2),
                orderCurrency: monetary.orderCurrency,
                fxBase: monetary.snapshot.base,
                fxRates: this.serializeFxSnapshot(monetary.snapshot),
                currencySnapshot: monetary.orderCurrency,
                taxRateSnapshot: (0, money_util_1.decimal)(taxRate).toFixed(4),
                exchangeRateSnapshot: this.serializeFxSnapshot(monetary.snapshot),
                validUntil: rawValidUntil ? new Date(rawValidUntil) : null,
                disclaimer,
                items: { create: monetary.items },
            },
        });
        await this.orderFinance.recalculateOrderFinancials(created.id);
        return true;
    }
    async replaceDocument(documentType, id, dto) {
        const existing = await this.prisma.order.findFirst({ where: { id, documentType } });
        if (!existing) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        const customerId = Number(dto.customerId);
        if (!customerId)
            throw new common_1.BadRequestException('sales.orders.validation.customerRequired');
        if (!Array.isArray(dto.items) || dto.items.length === 0) {
            throw new common_1.BadRequestException('sales.orders.validation.itemsRequired');
        }
        const taxRate = await this.getTaxRate();
        const monetary = await this.prepareOrderMonetaryData(dto, taxRate);
        const disclaimer = await this.resolveDocumentDisclaimer(dto.disclaimer);
        const composeAddress = (addr) => {
            if (!addr)
                return undefined;
            const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim();
            const line2 = addr.addressLine2 || (addr.corner ? `Esquina: ${addr.corner}` : '');
            return line1 && addr.city && addr.state
                ? { addressLine1: line1, addressLine2: line2, city: addr.city, state: addr.state }
                : undefined;
        };
        let paymentMethodId = null;
        if (dto.paymentMehod) {
            const maybeId = Number(dto.paymentMehod);
            if (!Number.isNaN(maybeId) && maybeId > 0) {
                const pm = await this.prisma.paymentMethod.findUnique({ where: { id: maybeId } });
                if (pm) {
                    paymentMethodId = pm.id;
                }
            }
            if (paymentMethodId === null) {
                const name = String(dto.paymentMehod).trim();
                if (name) {
                    const pm = await this.prisma.paymentMethod.upsert({
                        where: { name },
                        update: {},
                        create: { name },
                    });
                    paymentMethodId = pm.id;
                }
            }
        }
        let shippingAddress = composeAddress(dto.shippingAddress);
        if (!shippingAddress) {
            const primaryAddr = await this.prisma.customerAddress.findFirst({ where: { customerId, isPrimary: true } });
            if (!primaryAddr)
                throw new common_1.BadRequestException('sales.orders.validation.customerAddressRequired');
            shippingAddress = {
                addressLine1: `${primaryAddr.street} ${primaryAddr.number}${primaryAddr.apartment ? ' Apt ' + primaryAddr.apartment : ''}`,
                addressLine2: primaryAddr.corner ? `Esquina: ${primaryAddr.corner}` : '',
                city: primaryAddr.city,
                state: primaryAddr.country,
            };
        }
        const billingFromShipping = dto.billingSameAsShipping
            ? shippingAddress
            : composeAddress(dto.billingAddress);
        const rawValidUntil = dto.validUntil ?? dto.validUntilDate ?? null;
        let depositRequirement = null;
        if (dto.minimumDepositType !== undefined || dto.minimumDepositValue !== undefined) {
            depositRequirement = await this.orderFinance.resolveDepositRequirement({
                type: dto.minimumDepositType ?? null,
                value: dto.minimumDepositValue ?? null,
            });
        }
        await this.prisma.order.update({
            where: { id },
            data: {
                customerId,
                date: dto.date ? new Date(dto.date) : new Date(),
                shippingAddress1: shippingAddress.addressLine1,
                shippingAddress2: shippingAddress.addressLine2,
                shippingCity: shippingAddress.city,
                shippingState: shippingAddress.state,
                billingSameAsShipping: dto.billingSameAsShipping,
                billingAddress1: billingFromShipping?.addressLine1 ?? null,
                billingAddress2: billingFromShipping?.addressLine2 ?? null,
                billingCity: billingFromShipping?.city ?? null,
                billingState: billingFromShipping?.state ?? null,
                shippingVendor: dto.shipping?.shippingVendor,
                paymentMethodId,
                deliveryFees: monetary.delivery.toFixed(2),
                estimatedMin: dto.shipping?.estimatedMin,
                estimatedMax: dto.shipping?.estimatedMax,
                comment: dto.comment,
                subTotal: monetary.subTotal.toFixed(2),
                tax: monetary.tax.toFixed(2),
                grandTotal: monetary.grandTotal.toFixed(2),
                ...(depositRequirement
                    ? {
                        minimumDepositType: depositRequirement.type,
                        minimumDepositValue: depositRequirement.value.toFixed(2),
                    }
                    : {}),
                orderCurrency: monetary.orderCurrency,
                fxBase: monetary.snapshot.base,
                fxRates: this.serializeFxSnapshot(monetary.snapshot),
                currencySnapshot: monetary.orderCurrency,
                taxRateSnapshot: (0, money_util_1.decimal)(taxRate).toFixed(4),
                exchangeRateSnapshot: this.serializeFxSnapshot(monetary.snapshot),
                validUntil: rawValidUntil ? new Date(rawValidUntil) : existing.validUntil,
                documentFilePath: null,
                documentFileName: null,
                documentFileMime: null,
                documentFileSize: null,
                documentGeneratedAt: null,
                disclaimer,
                items: {
                    deleteMany: {},
                    create: monetary.items,
                },
            },
        });
        await (0, documents_1.deleteSalesDocumentFile)(existing.documentFilePath);
        await this.orderFinance.recalculateOrderFinancials(existing.id);
        return true;
    }
    async updateDocumentComment(documentType, id, body) {
        const result = await this.prisma.order.updateMany({
            where: { id: id, documentType },
            data: { comment: body.comment ?? null },
        });
        if (result.count === 0) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        return true;
    }
    async updateDocumentStatus(documentType, id, body) {
        if (documentType === client_1.DocumentType.ORDER) {
            await this.orderFinance.ensureStatusCanTransition(id, body.status, Boolean(body.force));
        }
        const result = await this.prisma.order.updateMany({
            where: { id: id, documentType },
            data: { statusId: body.status },
        });
        if (result.count === 0) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        return true;
    }
    async updateDocumentPaymentMethod(documentType, id, body) {
        const raw = body.paymentMehod;
        if (raw === undefined || raw === null || String(raw).trim() === '') {
            const cleared = await this.prisma.order.updateMany({
                where: { id, documentType },
                data: { paymentMethodId: null },
            });
            if (cleared.count === 0) {
                throw new common_1.BadRequestException('sales.orders.validation.notFound');
            }
            return true;
        }
        let pmId = null;
        let pm = null;
        const maybeNum = Number(raw);
        if (!Number.isNaN(maybeNum) && String(raw).trim() === String(maybeNum)) {
            pmId = maybeNum;
            pm = await this.prisma.paymentMethod.findUnique({ where: { id: pmId } });
        }
        if (!pm) {
            const name = String(raw).trim();
            pm = await this.prisma.paymentMethod.upsert({ where: { name }, update: {}, create: { name } });
        }
        const updated = await this.prisma.order.updateMany({
            where: { id: id, documentType },
            data: { paymentMethodId: pm.id },
        });
        if (updated.count === 0) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        return true;
    }
    async persistDocumentFile(documentType, id, file) {
        if (!file) {
            throw new common_1.BadRequestException('sales.orders.import.fileRequired');
        }
        const existing = await this.prisma.order.findFirst({
            where: { id, documentType },
            select: {
                id: true,
                documentFilePath: true,
            },
        });
        if (!existing) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        const stored = await (0, documents_1.persistSalesDocumentFile)(file, {
            documentType: documentType === client_1.DocumentType.BUDGET ? 'BUDGET' : 'ORDER',
            previousPath: existing.documentFilePath,
        });
        const updated = await this.prisma.order.update({
            where: { id: existing.id },
            data: {
                documentFilePath: stored.path,
                documentFileName: stored.name,
                documentFileMime: stored.mime,
                documentFileSize: stored.size,
                documentGeneratedAt: new Date(),
            },
            select: {
                documentFilePath: true,
                documentFileName: true,
                documentFileMime: true,
                documentFileSize: true,
                documentGeneratedAt: true,
            },
        });
        return {
            path: updated.documentFilePath,
            name: updated.documentFileName,
            mime: updated.documentFileMime,
            size: updated.documentFileSize,
            generatedAt: updated.documentGeneratedAt?.toISOString() ?? null,
        };
    }
    async sendBudget(id, userId) {
        const sentStatusId = await this.getBudgetStatusId('SENT');
        return this.prisma.$transaction(async (tx) => {
            const budget = await tx.order.findFirst({
                where: { id: id, documentType: client_1.DocumentType.BUDGET },
            });
            if (!budget) {
                throw new common_1.BadRequestException('sales.budgets.notFound');
            }
            const validity = budget.validUntil ?? this.computeDefaultValidity();
            await tx.order.update({
                where: { id: budget.id },
                data: {
                    statusId: sentStatusId,
                    validUntil: validity,
                    version: { increment: 1 },
                    updatedAt: new Date(),
                },
            });
            return {
                budgetId: budget.id,
                statusId: sentStatusId,
                validUntilDate: validity,
                validityDate: validity,
                updatedBy: userId ?? null,
            };
        });
    }
    async confirmBudget(id, userId) {
        const convertedStatusId = await this.getBudgetStatusId('CONVERTED');
        const defaultOrderStatus = await this.getDefaultOrderStatus();
        return this.prisma.$transaction(async (tx) => {
            const budget = await tx.order.findFirst({
                where: { id, documentType: client_1.DocumentType.BUDGET },
                include: { items: true },
            });
            if (!budget) {
                throw new common_1.BadRequestException('sales.budgets.notFound');
            }
            if (budget.convertedOrderId) {
                return { budgetId: budget.id, orderId: budget.convertedOrderId };
            }
            const fxRatesJson = budget.fxRates;
            const exchangeSnapshotJson = budget.exchangeRateSnapshot
                ? budget.exchangeRateSnapshot
                : fxRatesJson;
            const budgetDisclaimer = budget.disclaimer ?? (await this.getDefaultDocumentDisclaimer()) ?? null;
            const newOrder = await tx.order.create({
                data: {
                    documentType: client_1.DocumentType.ORDER,
                    originId: budget.id,
                    customerId: budget.customerId,
                    date: new Date(),
                    paymentMethodId: budget.paymentMethodId,
                    shippingAddress1: budget.shippingAddress1,
                    shippingAddress2: budget.shippingAddress2,
                    shippingCity: budget.shippingCity,
                    shippingState: budget.shippingState,
                    shippingZip: budget.shippingZip,
                    billingAddress1: budget.billingAddress1,
                    billingAddress2: budget.billingAddress2,
                    billingCity: budget.billingCity,
                    billingState: budget.billingState,
                    billingZip: budget.billingZip,
                    billingSameAsShipping: budget.billingSameAsShipping,
                    shippingVendor: budget.shippingVendor,
                    deliveryFees: this.decimalToString(budget.deliveryFees) ?? undefined,
                    estimatedMin: budget.estimatedMin,
                    estimatedMax: budget.estimatedMax,
                    comment: budget.comment,
                    disclaimer: budgetDisclaimer,
                    statusId: defaultOrderStatus?.id ?? null,
                    subTotal: this.decimalToString(budget.subTotal) ?? '0',
                    tax: this.decimalToString(budget.tax) ?? '0',
                    grandTotal: this.decimalToString(budget.grandTotal) ?? '0',
                    orderCurrency: budget.orderCurrency,
                    fxBase: budget.fxBase,
                    fxRates: fxRatesJson,
                    currencySnapshot: budget.currencySnapshot ?? budget.orderCurrency,
                    taxRateSnapshot: this.decimalToString(budget.taxRateSnapshot, 4),
                    exchangeRateSnapshot: exchangeSnapshotJson,
                    items: {
                        create: budget.items.map((item) => {
                            const specSummary = this.buildSpecSummary(item.customAttributes);
                            const mergedComment = [item.comments, specSummary].filter(Boolean).join('\n\n') || null;
                            return {
                                productId: item.productId ?? undefined,
                                name: item.name,
                                price: this.decimalToString(item.price) ?? '0',
                                qty: item.qty,
                                img: item.img,
                                description: item.description,
                                comments: mergedComment,
                                unitAmount: this.decimalToString(item.unitAmount, 4),
                                unitCurrency: item.unitCurrency ?? undefined,
                                unitAmountOrderCurrency: this.decimalToString(item.unitAmountOrderCurrency, 4),
                                conversionRate: this.decimalToString(item.conversionRate, 8),
                                unitCostAmount: this.decimalToString(item.unitCostAmount, 4),
                                unitCostCurrency: item.unitCostCurrency ?? undefined,
                                unitCostOrderCurrency: this.decimalToString(item.unitCostOrderCurrency, 4),
                                customAttributes: item.customAttributes,
                                pricingMethodSnapshot: item.pricingMethodSnapshot ?? undefined,
                                unitPriceSnapshot: this.decimalToString(item.unitPriceSnapshot, 4),
                                skuSnapshot: item.skuSnapshot ?? undefined,
                                nameSnapshot: item.nameSnapshot ?? item.name,
                                specSummary: specSummary ?? undefined,
                                specJson: (item.specJson ?? item.customAttributes),
                            };
                        }),
                    },
                },
            });
            await tx.order.update({
                where: { id: budget.id },
                data: {
                    statusId: convertedStatusId,
                    convertedOrderId: newOrder.id,
                    convertedAt: new Date(),
                    convertedBy: userId ?? undefined,
                    version: { increment: 1 },
                    updatedAt: new Date(),
                },
            });
            return { budgetId: budget.id, orderId: newOrder.id };
        });
    }
};
exports.SalesDocumentsService = SalesDocumentsService;
exports.SalesDocumentsService = SalesDocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        currency_conversion_service_1.CurrencyConversionService,
        order_finance_service_1.OrderFinanceService])
], SalesDocumentsService);
//# sourceMappingURL=sales-documents.service.js.map