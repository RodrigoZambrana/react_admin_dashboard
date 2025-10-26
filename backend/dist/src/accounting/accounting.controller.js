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
exports.AccountingController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const dashboard_dto_1 = require("./dto/dashboard.dto");
const pricing_1 = require("../sales/utils/pricing");
const CURRENCY_ORDER = ['IUSD', 'UYU', 'OTHER'];
const VAT_RATE = 0.22;
let AccountingController = class AccountingController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    startOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    }
    monthKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}`;
    }
    toUnix(date) {
        return Math.floor(date.getTime() / 1000);
    }
    roundCurrency(value) {
        return (0, pricing_1.roundCurrency)(value);
    }
    extractCurrencyKey(raw) {
        const normalized = raw?.trim().toUpperCase();
        if (!normalized) {
            return 'OTHER';
        }
        const alias = {
            IUSD: 'IUSD',
            USD: 'IUSD',
            'US$': 'IUSD',
            'U$S': 'IUSD',
            'U$D': 'IUSD',
            USD$: 'IUSD',
            DOLARES: 'IUSD',
            'DÓLARES': 'IUSD',
            DOLLARS: 'IUSD',
            UYU: 'UYU',
            'UY$': 'UYU',
            'UY$S': 'UYU',
            '$U': 'UYU',
            PESO: 'UYU',
            PESOS: 'UYU',
        };
        if (alias[normalized]) {
            return alias[normalized];
        }
        const sanitized = normalized.replace(/[^A-Z]/g, '');
        if (alias[sanitized]) {
            return alias[sanitized];
        }
        return 'OTHER';
    }
    mergeCurrencyTotals(target, source) {
        target.IUSD += source.IUSD;
        target.UYU += source.UYU;
        target.OTHER += source.OTHER;
    }
    emptyBreakdown() {
        return { IUSD: 0, UYU: 0, OTHER: 0 };
    }
    sumBreakdown(breakdown) {
        return (breakdown.IUSD ?? 0) + (breakdown.UYU ?? 0) + (breakdown.OTHER ?? 0);
    }
    computeVat(amount) {
        if (!Number.isFinite(amount) || amount === 0) {
            return { net: 0, vat: 0 };
        }
        const net = amount / (1 + VAT_RATE);
        const vat = amount - net;
        return { net, vat };
    }
    async dashboard(dto) {
        const { startDate, endDate } = dto ?? {};
        const dateRange = {};
        if (typeof startDate === 'number' && Number.isFinite(startDate)) {
            dateRange.gte = new Date(startDate * 1000);
        }
        if (typeof endDate === 'number' && Number.isFinite(endDate)) {
            dateRange.lte = new Date(endDate * 1000);
        }
        const orderWhere = {};
        const expenseWhere = {};
        if (Object.keys(dateRange).length > 0) {
            orderWhere.date = dateRange;
            expenseWhere.date = dateRange;
        }
        const [orders, expenses] = await Promise.all([
            this.prisma.order.findMany({
                where: orderWhere,
                select: {
                    date: true,
                    grandTotal: true,
                    tax: true,
                    orderCurrency: true,
                    items: {
                        select: {
                            price: true,
                            qty: true,
                            unitCurrency: true,
                            unitAmount: true,
                            unitAmountOrderCurrency: true,
                            unitCostOrderCurrency: true,
                            unitCostAmount: true,
                            unitCostCurrency: true,
                            conversionRate: true,
                            product: {
                                select: {
                                    currency: true,
                                    salePrice: true,
                                    costPrice: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.expense.findMany({
                where: expenseWhere,
                select: { date: true, amount: true, currency: true, taxCreditEligible: true },
            }),
        ]);
        const monthMap = new Map();
        const ensureAccumulator = (date) => {
            const monthStart = this.startOfMonth(date);
            const key = this.monthKey(monthStart);
            let acc = monthMap.get(key);
            if (!acc) {
                acc = {
                    month: monthStart,
                    sales: 0,
                    expenses: 0,
                    salesByCurrency: {
                        IUSD: 0,
                        UYU: 0,
                        OTHER: 0,
                    },
                    expensesByCurrency: {
                        IUSD: 0,
                        UYU: 0,
                        OTHER: 0,
                    },
                    salesVatByCurrency: {
                        IUSD: 0,
                        UYU: 0,
                        OTHER: 0,
                    },
                    purchaseVatByCurrency: {
                        IUSD: 0,
                        UYU: 0,
                        OTHER: 0,
                    },
                };
                monthMap.set(key, acc);
            }
            return acc;
        };
        for (const order of orders) {
            const orderDate = new Date(order.date);
            const acc = ensureAccumulator(orderDate);
            let orderSales = 0;
            if (Array.isArray(order.items) && order.items.length > 0) {
                for (const item of order.items) {
                    const qty = Number(item.qty ?? 0);
                    const normalizedQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
                    const unitPriceOrder = (0, pricing_1.decimalToNumber)(item.price);
                    const saleTotalOrderCurrency = this.roundCurrency(unitPriceOrder * normalizedQty);
                    orderSales += saleTotalOrderCurrency;
                    const unitAmountOriginal = (() => {
                        if (item.unitAmount !== null && item.unitAmount !== undefined) {
                            return (0, pricing_1.decimalToNumber)(item.unitAmount);
                        }
                        if (item.unitAmountOrderCurrency !== null &&
                            item.unitAmountOrderCurrency !== undefined &&
                            item.conversionRate !== null &&
                            item.conversionRate !== undefined) {
                            const derivedRate = (0, pricing_1.decimalToNumber)(item.conversionRate);
                            if (Number.isFinite(derivedRate) && derivedRate !== 0) {
                                const amountOrder = (0, pricing_1.decimalToNumber)(item.unitAmountOrderCurrency);
                                return amountOrder / derivedRate;
                            }
                        }
                        if (item.product?.currency) {
                            return (0, pricing_1.decimalToNumber)(item.product?.salePrice);
                        }
                        return unitPriceOrder;
                    })();
                    const saleTotalOriginal = this.roundCurrency(unitAmountOriginal * normalizedQty);
                    const saleCurrencyRaw = item.unitCurrency ?? item.product?.currency ?? order.orderCurrency ?? null;
                    const saleCurrencyKey = this.extractCurrencyKey(saleCurrencyRaw);
                    acc.salesByCurrency[saleCurrencyKey] += saleTotalOriginal;
                    const { vat: saleVatOriginal } = this.computeVat(saleTotalOriginal);
                    acc.salesVatByCurrency[saleCurrencyKey] += saleVatOriginal;
                    const unitCostOriginal = (() => {
                        if (item.unitCostAmount !== null && item.unitCostAmount !== undefined) {
                            return (0, pricing_1.decimalToNumber)(item.unitCostAmount);
                        }
                        if (item.unitCostOrderCurrency !== null &&
                            item.unitCostOrderCurrency !== undefined &&
                            item.conversionRate !== null &&
                            item.conversionRate !== undefined) {
                            const derivedRate = (0, pricing_1.decimalToNumber)(item.conversionRate);
                            if (Number.isFinite(derivedRate) && derivedRate !== 0) {
                                const costOrder = (0, pricing_1.decimalToNumber)(item.unitCostOrderCurrency);
                                return costOrder / derivedRate;
                            }
                        }
                        if (item.product?.costPrice !== undefined && item.product?.costPrice !== null) {
                            return (0, pricing_1.decimalToNumber)(item.product?.costPrice);
                        }
                        return 0;
                    })();
                    const costTotalOriginal = this.roundCurrency(unitCostOriginal * normalizedQty);
                    if (costTotalOriginal > 0) {
                        const costCurrencyRaw = item.unitCostCurrency ?? item.unitCurrency ?? item.product?.currency ?? order.orderCurrency ?? null;
                        const costCurrencyKey = this.extractCurrencyKey(costCurrencyRaw);
                        const { vat: costVatOriginal } = this.computeVat(costTotalOriginal);
                        acc.purchaseVatByCurrency[costCurrencyKey] += costVatOriginal;
                    }
                }
            }
            if (orderSales <= 0) {
                const fallbackTotal = (0, pricing_1.decimalToNumber)(order.grandTotal);
                const normalizedFallback = Number.isFinite(fallbackTotal) ? fallbackTotal : 0;
                if (normalizedFallback !== 0) {
                    const currencyKey = this.extractCurrencyKey(order.orderCurrency ?? null);
                    acc.salesByCurrency[currencyKey] += normalizedFallback;
                    const { vat: saleVat } = this.computeVat(normalizedFallback);
                    acc.salesVatByCurrency[currencyKey] += saleVat;
                    orderSales += normalizedFallback;
                }
            }
            acc.sales += orderSales;
        }
        for (const expense of expenses) {
            const expenseDate = new Date(expense.date);
            const acc = ensureAccumulator(expenseDate);
            const amount = (0, pricing_1.decimalToNumber)(expense.amount);
            const normalizedAmount = Number.isFinite(amount) ? amount : 0;
            const currencyKey = this.extractCurrencyKey(expense.currency);
            acc.expenses += normalizedAmount;
            acc.expensesByCurrency[currencyKey] += normalizedAmount;
            if (expense.taxCreditEligible) {
                const { vat: expenseVat } = this.computeVat(normalizedAmount);
                acc.purchaseVatByCurrency[currencyKey] += expenseVat;
            }
        }
        let rangeStart;
        let rangeEnd;
        if (typeof startDate === 'number' && Number.isFinite(startDate)) {
            rangeStart = this.startOfMonth(new Date(startDate * 1000));
        }
        if (typeof endDate === 'number' && Number.isFinite(endDate)) {
            rangeEnd = this.startOfMonth(new Date(endDate * 1000));
        }
        for (const { month } of monthMap.values()) {
            if (!rangeStart || month < rangeStart) {
                rangeStart = month;
            }
            if (!rangeEnd || month > rangeEnd) {
                rangeEnd = month;
            }
        }
        if (!rangeStart || !rangeEnd) {
            const today = this.startOfMonth(new Date());
            rangeStart = today;
            rangeEnd = today;
        }
        if (rangeStart > rangeEnd) {
            const tmp = rangeStart;
            rangeStart = rangeEnd;
            rangeEnd = tmp;
        }
        const monthly = [];
        let totalSales = 0;
        let totalExpenses = 0;
        let totalTaxes = 0;
        const totalSalesByCurrency = this.emptyBreakdown();
        const totalExpensesByCurrency = this.emptyBreakdown();
        const totalTaxesByCurrency = this.emptyBreakdown();
        for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
            const key = this.monthKey(cursor);
            const acc = monthMap.get(key) ?? {
                month: this.startOfMonth(cursor),
                sales: 0,
                expenses: 0,
                salesByCurrency: this.emptyBreakdown(),
                expensesByCurrency: this.emptyBreakdown(),
                salesVatByCurrency: this.emptyBreakdown(),
                purchaseVatByCurrency: this.emptyBreakdown(),
            };
            this.mergeCurrencyTotals(totalSalesByCurrency, acc.salesByCurrency);
            this.mergeCurrencyTotals(totalExpensesByCurrency, acc.expensesByCurrency);
            const taxesByCurrencyRaw = {
                IUSD: (acc.salesVatByCurrency.IUSD ?? 0) - (acc.purchaseVatByCurrency.IUSD ?? 0),
                UYU: (acc.salesVatByCurrency.UYU ?? 0) - (acc.purchaseVatByCurrency.UYU ?? 0),
                OTHER: (acc.salesVatByCurrency.OTHER ?? 0) - (acc.purchaseVatByCurrency.OTHER ?? 0),
            };
            this.mergeCurrencyTotals(totalTaxesByCurrency, taxesByCurrencyRaw);
            const roundedSalesByCurrency = {
                IUSD: this.roundCurrency(acc.salesByCurrency.IUSD ?? 0),
                UYU: this.roundCurrency(acc.salesByCurrency.UYU ?? 0),
                OTHER: this.roundCurrency(acc.salesByCurrency.OTHER ?? 0),
            };
            const roundedExpensesByCurrency = {
                IUSD: this.roundCurrency(acc.expensesByCurrency.IUSD ?? 0),
                UYU: this.roundCurrency(acc.expensesByCurrency.UYU ?? 0),
                OTHER: this.roundCurrency(acc.expensesByCurrency.OTHER ?? 0),
            };
            const roundedTaxesByCurrency = {
                IUSD: this.roundCurrency(taxesByCurrencyRaw.IUSD),
                UYU: this.roundCurrency(taxesByCurrencyRaw.UYU),
                OTHER: this.roundCurrency(taxesByCurrencyRaw.OTHER),
            };
            const netTaxRaw = this.sumBreakdown(taxesByCurrencyRaw);
            const netIncomeRaw = acc.sales - (acc.expenses + netTaxRaw);
            const netIncomeByCurrency = {
                IUSD: this.roundCurrency((acc.salesByCurrency.IUSD ?? 0) -
                    ((acc.expensesByCurrency.IUSD ?? 0) + taxesByCurrencyRaw.IUSD)),
                UYU: this.roundCurrency((acc.salesByCurrency.UYU ?? 0) -
                    ((acc.expensesByCurrency.UYU ?? 0) + taxesByCurrencyRaw.UYU)),
                OTHER: this.roundCurrency((acc.salesByCurrency.OTHER ?? 0) -
                    ((acc.expensesByCurrency.OTHER ?? 0) + taxesByCurrencyRaw.OTHER)),
            };
            monthly.push({
                month: this.toUnix(acc.month),
                sales: this.roundCurrency(acc.sales),
                expenses: this.roundCurrency(acc.expenses),
                taxes: this.roundCurrency(netTaxRaw),
                netIncome: this.roundCurrency(netIncomeRaw),
                salesByCurrency: roundedSalesByCurrency,
                expensesByCurrency: roundedExpensesByCurrency,
                taxesByCurrency: roundedTaxesByCurrency,
                netIncomeByCurrency,
            });
            totalSales += acc.sales;
            totalExpenses += acc.expenses;
            totalTaxes += netTaxRaw;
        }
        const roundedSalesTotalsByCurrency = {
            IUSD: this.roundCurrency(totalSalesByCurrency.IUSD),
            UYU: this.roundCurrency(totalSalesByCurrency.UYU),
            OTHER: this.roundCurrency(totalSalesByCurrency.OTHER),
        };
        const roundedExpensesTotalsByCurrency = {
            IUSD: this.roundCurrency(totalExpensesByCurrency.IUSD),
            UYU: this.roundCurrency(totalExpensesByCurrency.UYU),
            OTHER: this.roundCurrency(totalExpensesByCurrency.OTHER),
        };
        const roundedTaxesTotalsByCurrency = {
            IUSD: this.roundCurrency(totalTaxesByCurrency.IUSD),
            UYU: this.roundCurrency(totalTaxesByCurrency.UYU),
            OTHER: this.roundCurrency(totalTaxesByCurrency.OTHER),
        };
        const totalNetIncome = totalSales - (totalExpenses + totalTaxes);
        const roundedBalanceByCurrency = {
            IUSD: this.roundCurrency(totalSalesByCurrency.IUSD - totalExpensesByCurrency.IUSD),
            UYU: this.roundCurrency(totalSalesByCurrency.UYU - totalExpensesByCurrency.UYU),
            OTHER: this.roundCurrency(totalSalesByCurrency.OTHER - totalExpensesByCurrency.OTHER),
        };
        const totalNetIncomeByCurrency = {
            IUSD: this.roundCurrency(totalSalesByCurrency.IUSD - (totalExpensesByCurrency.IUSD + totalTaxesByCurrency.IUSD)),
            UYU: this.roundCurrency(totalSalesByCurrency.UYU - (totalExpensesByCurrency.UYU + totalTaxesByCurrency.UYU)),
            OTHER: this.roundCurrency(totalSalesByCurrency.OTHER - (totalExpensesByCurrency.OTHER + totalTaxesByCurrency.OTHER)),
        };
        const currencySummary = CURRENCY_ORDER.map((currency) => ({
            currency,
            sales: this.roundCurrency(totalSalesByCurrency[currency]),
            expenses: this.roundCurrency(totalExpensesByCurrency[currency]),
            taxes: this.roundCurrency(totalTaxesByCurrency[currency]),
            balance: this.roundCurrency(totalSalesByCurrency[currency] - totalExpensesByCurrency[currency]),
            liquidIncome: this.roundCurrency(totalSalesByCurrency[currency] - (totalExpensesByCurrency[currency] + totalTaxesByCurrency[currency])),
        }));
        return {
            range: {
                start: this.toUnix(rangeStart),
                end: this.toUnix(rangeEnd),
                granularity: 'month',
            },
            monthly,
            totals: {
                sales: this.roundCurrency(totalSales),
                expenses: this.roundCurrency(totalExpenses),
                taxes: this.roundCurrency(totalTaxes),
                balance: this.roundCurrency(totalSales - totalExpenses),
                netIncome: this.roundCurrency(totalNetIncome),
                salesByCurrency: roundedSalesTotalsByCurrency,
                expensesByCurrency: roundedExpensesTotalsByCurrency,
                taxesByCurrency: roundedTaxesTotalsByCurrency,
                balanceByCurrency: roundedBalanceByCurrency,
                netIncomeByCurrency: totalNetIncomeByCurrency,
            },
            currencySummary,
        };
    }
};
exports.AccountingController = AccountingController;
__decorate([
    (0, common_1.Post)('dashboard'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dashboard_dto_1.DashboardFilterDto]),
    __metadata("design:returntype", Promise)
], AccountingController.prototype, "dashboard", null);
exports.AccountingController = AccountingController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('accounting'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccountingController);
//# sourceMappingURL=accounting.controller.js.map