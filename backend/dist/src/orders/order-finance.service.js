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
exports.OrderFinanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const money_util_1 = require("../common/currency/money.util");
let OrderFinanceService = class OrderFinanceService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    STATUS_CODES = {
        PENDING: 100,
        CONFIRMED: 200,
        WORK_ORDER: 300,
        READY: 400,
        DELIVERED: 500,
        CLOSED: 600,
    };
    statusCache = new Map();
    async getStatusId(code, client) {
        if (this.statusCache.has(code)) {
            return this.statusCache.get(code) ?? null;
        }
        const status = await client.orderStatus.findUnique({ where: { code } });
        const statusId = status?.id ?? null;
        this.statusCache.set(code, statusId);
        return statusId;
    }
    async getDefaultDepositRequirement(client) {
        const config = await client.systemConfig.findUnique({
            where: { key: 'orderMinimumDeposit' },
        });
        if (config?.value) {
            try {
                const parsed = JSON.parse(config.value);
                const typeValue = parsed?.type === 'FIXED' ? client_1.DepositRequirementType.FIXED : client_1.DepositRequirementType.PERCENTAGE;
                const rawValue = typeof parsed?.value === 'number'
                    ? parsed?.value
                    : typeof parsed?.value === 'string'
                        ? Number(parsed.value)
                        : 0;
                if (!Number.isNaN(rawValue)) {
                    return { type: typeValue, value: (0, money_util_1.decimal)(rawValue) };
                }
            }
            catch {
            }
        }
        return { type: client_1.DepositRequirementType.PERCENTAGE, value: (0, money_util_1.decimal)(30) };
    }
    async resolveDepositRequirement(params = {}, client) {
        const targetClient = client ?? this.prisma;
        const rawType = params.type;
        const normalizedType = typeof rawType === 'string'
            ? rawType.trim().toUpperCase()
            : rawType ?? undefined;
        const parsedType = normalizedType === 'FIXED'
            ? client_1.DepositRequirementType.FIXED
            : normalizedType === 'PERCENTAGE'
                ? client_1.DepositRequirementType.PERCENTAGE
                : undefined;
        const rawValue = params.value;
        const parsedValue = rawValue === null || rawValue === undefined || rawValue === ''
            ? Number.NaN
            : rawValue instanceof client_1.Prisma.Decimal
                ? Number(rawValue.toString())
                : Number(rawValue);
        if (parsedType && Number.isFinite(parsedValue)) {
            return { type: parsedType, value: (0, money_util_1.decimal)(parsedValue) };
        }
        return this.getDefaultDepositRequirement(targetClient);
    }
    computeDepositRequirement(grandTotal, type, value) {
        const normalizedValue = (0, money_util_1.decimal)(value);
        if (type === client_1.DepositRequirementType.FIXED) {
            return normalizedValue.lessThan(0) ? (0, money_util_1.decimal)(0) : normalizedValue;
        }
        if (normalizedValue.lessThanOrEqualTo(0)) {
            return (0, money_util_1.decimal)(0);
        }
        const ratio = (0, money_util_1.divideDecimals)(normalizedValue, 100);
        const required = (0, money_util_1.multiplyDecimals)(grandTotal, ratio);
        return required.lessThan(0) ? (0, money_util_1.decimal)(0) : required;
    }
    aggregatePayments(payments) {
        let depositConfirmed = (0, money_util_1.decimal)(0);
        let balanceConfirmed = (0, money_util_1.decimal)(0);
        let refundsConfirmed = (0, money_util_1.decimal)(0);
        let depositPending = (0, money_util_1.decimal)(0);
        let balancePending = (0, money_util_1.decimal)(0);
        let refundsPending = (0, money_util_1.decimal)(0);
        for (const payment of payments) {
            const amount = (0, money_util_1.decimal)(payment.amount);
            if (payment.status === client_1.PaymentStatus.CONFIRMED) {
                if (payment.type === client_1.PaymentType.DEPOSIT) {
                    depositConfirmed = (0, money_util_1.addDecimals)(depositConfirmed, amount);
                }
                else if (payment.type === client_1.PaymentType.BALANCE) {
                    balanceConfirmed = (0, money_util_1.addDecimals)(balanceConfirmed, amount);
                }
                else if (payment.type === client_1.PaymentType.REFUND) {
                    refundsConfirmed = (0, money_util_1.addDecimals)(refundsConfirmed, amount);
                }
                continue;
            }
            if (payment.status === client_1.PaymentStatus.REGISTERED) {
                if (payment.type === client_1.PaymentType.DEPOSIT) {
                    depositPending = (0, money_util_1.addDecimals)(depositPending, amount);
                }
                else if (payment.type === client_1.PaymentType.BALANCE) {
                    balancePending = (0, money_util_1.addDecimals)(balancePending, amount);
                }
                else if (payment.type === client_1.PaymentType.REFUND) {
                    refundsPending = (0, money_util_1.addDecimals)(refundsPending, amount);
                }
            }
        }
        return {
            depositConfirmed,
            balanceConfirmed,
            refundsConfirmed,
            depositPending,
            balancePending,
            refundsPending,
        };
    }
    generateWorkOrderCode(orderId) {
        const stamp = Date.now().toString(36).toUpperCase();
        return `WO-${orderId}-${stamp}`;
    }
    async recalculateOrderFinancials(orderId, tx) {
        const client = (tx ?? this.prisma);
        const order = await client.order.findUnique({
            where: { id: orderId },
            include: {
                payments: true,
                status: true,
                workOrders: true,
            },
        });
        if (!order) {
            throw new common_1.BadRequestException('sales.orders.validation.notFound');
        }
        const grandTotal = (0, money_util_1.decimal)(order.grandTotal);
        const depositType = order.minimumDepositType ?? client_1.DepositRequirementType.PERCENTAGE;
        const depositValue = order.minimumDepositValue !== null && order.minimumDepositValue !== undefined
            ? (0, money_util_1.decimal)(order.minimumDepositValue)
            : (await this.getDefaultDepositRequirement(client)).value;
        const depositRequired = this.computeDepositRequirement(grandTotal, depositType, depositValue);
        const aggregates = this.aggregatePayments(order.payments.map((payment) => ({
            amount: payment.amount,
            type: payment.type,
            status: payment.status,
        })));
        const totalPaidConfirmed = (0, money_util_1.subtractDecimals)((0, money_util_1.addDecimals)(aggregates.depositConfirmed, aggregates.balanceConfirmed), aggregates.refundsConfirmed);
        const outstandingRaw = (0, money_util_1.subtractDecimals)(grandTotal, totalPaidConfirmed);
        const outstanding = outstandingRaw.isNegative() ? (0, money_util_1.decimal)(0) : outstandingRaw;
        const credit = outstandingRaw.isNegative() ? outstandingRaw.abs() : (0, money_util_1.decimal)(0);
        const depositMet = aggregates.depositConfirmed.greaterThanOrEqualTo((0, money_util_1.roundDecimal)(depositRequired, 2));
        const now = new Date();
        const updateData = {
            customerCredit: (0, money_util_1.roundDecimal)(credit, 2).toFixed(2),
        };
        if (depositMet && !order.depositSatisfiedAt) {
            updateData.depositSatisfiedAt = now;
        }
        if (!depositMet && order.depositSatisfiedAt) {
            updateData.depositSatisfiedAt = null;
        }
        const pendingStatusId = await this.getStatusId(this.STATUS_CODES.PENDING, client);
        const confirmedStatusId = await this.getStatusId(this.STATUS_CODES.CONFIRMED, client);
        const slug = this.config.get('CLIENT_SLUG') || this.config.get('CLIENT') || '';
        const enableWorkOrders = slug.toLowerCase() === 'urucortinas';
        let targetWorkOrderId = order.workOrders[0]?.id ?? null;
        if (depositMet) {
            if (!order.confirmedAt) {
                updateData.confirmedAt = now;
            }
            if (confirmedStatusId &&
                ((pendingStatusId && order.statusId === pendingStatusId) || order.statusId === null)) {
                updateData.status = { connect: { id: confirmedStatusId } };
            }
            if (enableWorkOrders && !targetWorkOrderId) {
                const workOrder = await client.workOrder.create({
                    data: {
                        orderId: order.id,
                        code: this.generateWorkOrderCode(order.id),
                        status: client_1.WorkOrderStatus.PENDING,
                    },
                });
                targetWorkOrderId = workOrder.id;
            }
        }
        else if (order.confirmedAt && confirmedStatusId && order.statusId === confirmedStatusId) {
            updateData.confirmedAt = null;
        }
        await client.order.update({
            where: { id: order.id },
            data: updateData,
        });
        if (depositMet && enableWorkOrders && targetWorkOrderId) {
            const existingProduction = await client.productionOrder.findFirst({
                where: { orderId: order.id },
            });
            if (!existingProduction) {
                await client.productionOrder.create({
                    data: {
                        orderId: order.id,
                        workOrderId: targetWorkOrderId,
                        status: client_1.WorkOrderStatus.PENDING,
                        priority: 1,
                    },
                });
            }
            else if (existingProduction.workOrderId !== targetWorkOrderId) {
                await client.productionOrder.update({
                    where: { id: existingProduction.id },
                    data: { workOrderId: targetWorkOrderId },
                });
            }
        }
        return {
            orderId: order.id,
            currency: order.orderCurrency,
            grandTotal,
            depositRequired: (0, money_util_1.roundDecimal)(depositRequired, 2),
            depositPaidConfirmed: (0, money_util_1.roundDecimal)(aggregates.depositConfirmed, 2),
            balancePaidConfirmed: (0, money_util_1.roundDecimal)(aggregates.balanceConfirmed, 2),
            refundsConfirmed: (0, money_util_1.roundDecimal)(aggregates.refundsConfirmed, 2),
            totalPaidConfirmed: (0, money_util_1.roundDecimal)(totalPaidConfirmed, 2),
            depositPending: (0, money_util_1.roundDecimal)(aggregates.depositPending, 2),
            balancePending: (0, money_util_1.roundDecimal)(aggregates.balancePending, 2),
            refundsPending: (0, money_util_1.roundDecimal)(aggregates.refundsPending, 2),
            outstanding: (0, money_util_1.roundDecimal)(outstanding, 2),
            customerCredit: (0, money_util_1.roundDecimal)(credit, 2),
            depositMet,
        };
    }
    async ensureStatusCanTransition(orderId, targetStatusId, force = false) {
        await this.prisma.$transaction(async (tx) => {
            const summary = await this.recalculateOrderFinancials(orderId, tx);
            const targetStatus = await tx.orderStatus.findUnique({
                where: { id: targetStatusId },
            });
            if (!targetStatus) {
                throw new common_1.BadRequestException('sales.orders.validation.statusInvalid');
            }
            const targetCode = targetStatus.code;
            if ((targetCode === this.STATUS_CODES.CONFIRMED ||
                targetCode === this.STATUS_CODES.WORK_ORDER ||
                targetCode === this.STATUS_CODES.READY ||
                targetCode === this.STATUS_CODES.DELIVERED ||
                targetCode === this.STATUS_CODES.CLOSED) &&
                !summary.depositMet) {
                throw new common_1.BadRequestException('sales.orders.validation.depositRequired');
            }
            if ((targetCode === this.STATUS_CODES.DELIVERED || targetCode === this.STATUS_CODES.CLOSED) &&
                summary.outstanding.greaterThan(0) &&
                !force) {
                throw new common_1.BadRequestException('sales.orders.validation.balanceOutstanding');
            }
        });
    }
    async getOrderPaymentSummary(orderId) {
        return this.recalculateOrderFinancials(orderId);
    }
};
exports.OrderFinanceService = OrderFinanceService;
exports.OrderFinanceService = OrderFinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, config_1.ConfigService])
], OrderFinanceService);
//# sourceMappingURL=order-finance.service.js.map