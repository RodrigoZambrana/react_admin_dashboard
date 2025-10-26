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
exports.CurrencyConversionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const currency_constants_1 = require("./currency.constants");
const money_util_1 = require("./money.util");
let CurrencyConversionService = class CurrencyConversionService {
    prisma;
    fallbackCurrencies = currency_constants_1.STANDARD_DEFAULT_CURRENCIES;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isPrismaService(client) {
        return typeof client.$transaction === 'function';
    }
    async withTransaction(client, fn) {
        if (this.isPrismaService(client)) {
            return client.$transaction((tx) => fn(tx));
        }
        return fn(client);
    }
    getStandardCurrencies() {
        return currency_constants_1.STANDARD_CURRENCIES;
    }
    normalizeCurrency(code) {
        if (!code)
            return null;
        const trimmed = String(code).trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(trimmed)) {
            return null;
        }
        if (!currency_constants_1.STANDARD_CURRENCY_CODES.has(trimmed)) {
            return null;
        }
        return trimmed;
    }
    async getEnabledCurrencies() {
        const record = await this.prisma.systemConfig.findUnique({ where: { key: 'currencies' } });
        const fallback = [...this.fallbackCurrencies];
        if (!record) {
            return fallback;
        }
        try {
            const parsed = JSON.parse(record.value);
            if (Array.isArray(parsed)) {
                const normalized = parsed
                    .map((item) => this.normalizeCurrency(item))
                    .filter((item) => Boolean(item));
                return normalized.length ? Array.from(new Set(normalized)) : fallback;
            }
        }
        catch (error) {
        }
        return fallback;
    }
    async setEnabledCurrencies(codes, client = this.prisma) {
        const normalized = codes
            .map((code) => this.normalizeCurrency(code))
            .filter((code) => Boolean(code));
        if (!normalized.length) {
            throw new common_1.BadRequestException('At least one valid currency must be provided');
        }
        const unique = Array.from(new Set(normalized));
        await client.systemConfig.upsert({
            where: { key: 'currencies' },
            update: { value: JSON.stringify(unique) },
            create: { key: 'currencies', value: JSON.stringify(unique) },
        });
        return unique;
    }
    async getBaseCurrency() {
        const record = await this.prisma.systemConfig.findUnique({ where: { key: 'currencyBase' } });
        const normalized = this.normalizeCurrency(record?.value);
        if (normalized)
            return normalized;
        return this.fallbackCurrencies[1] ?? 'USD';
    }
    async setBaseCurrency(code, client = this.prisma) {
        const normalized = this.normalizeCurrency(code);
        if (!normalized) {
            throw new common_1.BadRequestException('Invalid currency code');
        }
        await client.systemConfig.upsert({
            where: { key: 'currencyBase' },
            update: { value: normalized },
            create: { key: 'currencyBase', value: normalized },
        });
        return normalized;
    }
    async listRates(base) {
        const resolvedBase = base ?? (await this.getBaseCurrency());
        return this.prisma.currencyRate.findMany({
            where: { base: resolvedBase },
            orderBy: { quote: 'asc' },
        });
    }
    async replaceRates(base, entries, client = this.prisma) {
        const normalizedBase = this.normalizeCurrency(base);
        if (!normalizedBase) {
            throw new common_1.BadRequestException('Invalid base currency');
        }
        const normalizedEntries = entries
            .map((entry) => ({
            quote: this.normalizeCurrency(entry.quote),
            rate: (0, money_util_1.decimal)(entry.rate),
        }))
            .filter((entry) => {
            if (!entry.quote) {
                return false;
            }
            if (entry.rate.isZero() || entry.rate.isNegative()) {
                throw new common_1.BadRequestException(`Invalid rate for ${entry.quote}`);
            }
            if (entry.quote === normalizedBase) {
                return false;
            }
            return true;
        });
        const uniqueEntries = new Map();
        for (const entry of normalizedEntries) {
            uniqueEntries.set(entry.quote, entry.rate);
        }
        const prepared = Array.from(uniqueEntries.entries()).map(([quote, rate]) => ({
            base: normalizedBase,
            quote,
            rate: rate.toFixed(8),
        }));
        await this.withTransaction(client, async (tx) => {
            await tx.currencyRate.deleteMany({ where: { base: normalizedBase } });
            if (prepared.length) {
                await tx.currencyRate.createMany({
                    data: prepared,
                });
            }
        });
        return this.prisma.currencyRate.findMany({
            where: { base: normalizedBase },
            orderBy: { quote: 'asc' },
        });
    }
    async buildRatesSnapshot(requiredCurrencies) {
        const normalizedRequired = Array.from(new Set(requiredCurrencies
            .map((currency) => this.normalizeCurrency(currency))
            .filter((currency) => Boolean(currency))));
        const base = await this.getBaseCurrency();
        const targets = normalizedRequired.filter((currency) => currency !== base);
        const records = await this.prisma.currencyRate.findMany({
            where: { base, quote: { in: targets } },
        });
        const rateMap = new Map();
        rateMap.set(base, new client_1.Prisma.Decimal(1));
        for (const record of records) {
            rateMap.set(record.quote, new client_1.Prisma.Decimal(record.rate));
        }
        for (const currency of targets) {
            if (!rateMap.has(currency)) {
                throw new common_1.BadRequestException(`Missing exchange rate for ${base} -> ${currency}`);
            }
        }
        const snapshotRates = {};
        for (const [currency, rate] of rateMap.entries()) {
            snapshotRates[currency] = rate;
        }
        return {
            base,
            rates: snapshotRates,
            generatedAt: new Date().toISOString(),
        };
    }
    convertWithSnapshot(amount, fromCurrency, toCurrency, snapshot, options) {
        const normalizedFrom = this.normalizeCurrency(fromCurrency);
        const normalizedTo = this.normalizeCurrency(toCurrency);
        if (!normalizedFrom || !normalizedTo) {
            throw new common_1.BadRequestException('Invalid currency conversion request');
        }
        const base = snapshot.base;
        const rates = snapshot.rates;
        const amountScale = options?.amountScale ?? 4;
        const rateScale = options?.rateScale ?? 8;
        const rateFrom = normalizedFrom === base ? new client_1.Prisma.Decimal(1) : rates[normalizedFrom];
        const rateTo = normalizedTo === base ? new client_1.Prisma.Decimal(1) : rates[normalizedTo];
        if (!rateFrom) {
            throw new common_1.BadRequestException(`Missing exchange rate for ${base} -> ${normalizedFrom}`);
        }
        if (!rateTo) {
            throw new common_1.BadRequestException(`Missing exchange rate for ${base} -> ${normalizedTo}`);
        }
        const amountDecimal = (0, money_util_1.roundDecimal)(amount, amountScale);
        let amountInBase = amountDecimal;
        if (normalizedFrom !== base) {
            amountInBase = (0, money_util_1.roundDecimal)((0, money_util_1.multiplyDecimals)(amountInBase, rateFrom), amountScale);
        }
        let converted = amountInBase;
        if (normalizedTo !== base) {
            converted = (0, money_util_1.roundDecimal)((0, money_util_1.divideDecimals)(converted, rateTo), amountScale);
        }
        let effectiveRate = (0, money_util_1.roundDecimal)(1, rateScale);
        if (normalizedFrom !== base) {
            effectiveRate = (0, money_util_1.roundDecimal)((0, money_util_1.multiplyDecimals)(effectiveRate, rateFrom), rateScale);
        }
        if (normalizedTo !== base) {
            effectiveRate = (0, money_util_1.roundDecimal)((0, money_util_1.divideDecimals)(effectiveRate, rateTo), rateScale);
        }
        return {
            amount: converted,
            rate: effectiveRate,
        };
    }
};
exports.CurrencyConversionService = CurrencyConversionService;
exports.CurrencyConversionService = CurrencyConversionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CurrencyConversionService);
//# sourceMappingURL=currency-conversion.service.js.map