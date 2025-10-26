import { DepositRequirementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;
export type OrderPaymentSummary = {
    orderId: number;
    currency: string;
    grandTotal: Prisma.Decimal;
    depositRequired: Prisma.Decimal;
    depositPaidConfirmed: Prisma.Decimal;
    balancePaidConfirmed: Prisma.Decimal;
    refundsConfirmed: Prisma.Decimal;
    totalPaidConfirmed: Prisma.Decimal;
    depositPending: Prisma.Decimal;
    balancePending: Prisma.Decimal;
    refundsPending: Prisma.Decimal;
    outstanding: Prisma.Decimal;
    customerCredit: Prisma.Decimal;
    depositMet: boolean;
};
export declare class OrderFinanceService {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService);
    private readonly STATUS_CODES;
    private readonly statusCache;
    private getStatusId;
    private getDefaultDepositRequirement;
    resolveDepositRequirement(params?: {
        type?: string | DepositRequirementType | null;
        value?: number | string | Prisma.Decimal | null;
    }, client?: PrismaClientOrTx): Promise<{
        type: DepositRequirementType;
        value: Prisma.Decimal;
    }>;
    private computeDepositRequirement;
    private aggregatePayments;
    private generateWorkOrderCode;
    recalculateOrderFinancials(orderId: number, tx?: Prisma.TransactionClient): Promise<OrderPaymentSummary>;
    ensureStatusCanTransition(orderId: number, targetStatusId: number, force?: boolean): Promise<void>;
    getOrderPaymentSummary(orderId: number): Promise<OrderPaymentSummary>;
}
export {};
