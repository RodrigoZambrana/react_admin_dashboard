import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FastifyReply } from 'fastify';
import { DashboardFilterDto } from './dto/dashboard.dto';
export declare class ExpensesController {
    private prisma;
    constructor(prisma: PrismaService);
    private decodeAttachmentContent;
    private toPrismaBytes;
    private extractAttachmentPayload;
    private serializeAttachments;
    private toNullableNumber;
    private resolveExpenseDate;
    private startOfDay;
    private dayKey;
    private normalizeCurrency;
    private normalizeBooleanFlag;
    private resolveScalarParam;
    private normalizeExpenseDirection;
    private normalizeExpenseSortKey;
    private parseSortObject;
    private extractExpenseSort;
    private buildExpenseOrderBy;
    dashboard(dto: DashboardFilterDto): Promise<{
        statisticData: {
            total: {
                value: number;
                growShrink: number;
            };
            transactions: {
                value: number;
                growShrink: number;
            };
            recurring: {
                value: number;
                growShrink: number;
            };
        };
        expensesReportData: {
            series: {
                name: string;
                data: number[];
            }[];
            categories: number[];
            granularity: "day" | "hour" | "month";
        };
        latestExpensesData: {
            id: string;
            date: number;
            name: string;
            vendor: string;
            statusId: number | null;
            statusName: string;
            statusColor: string | null;
            paymentMethodId: number | null;
            paymentMethodName: string;
            paymentReference: string;
            amount: Prisma.Decimal;
            currency: string | null;
            taxCreditEligible: boolean;
            attachments: Record<string, unknown>[];
        }[];
        expensesByCategoriesData: {
            labels: string[];
            data: number[];
        };
    }>;
    list(q: any): Promise<{
        data: {
            id: string;
            date: number;
            name: string;
            vendor: string;
            categoryId: number | null;
            categoryName: string;
            statusId: number | null;
            statusName: string;
            statusColor: string | null;
            paymentMethodId: number | null;
            paymentMethodName: string;
            paymentReference: string;
            amount: Prisma.Decimal;
            note: string;
            currency: string | null;
            taxCreditEligible: boolean;
            attachments: Record<string, unknown>[];
        }[];
        total: number;
    }>;
    delete(body: {
        id: string | string[];
    }): Promise<boolean>;
    detail(id: string): Promise<{
        id: string;
        name: string;
        title: string;
        vendor: string;
        amount: Prisma.Decimal;
        date: number;
        categoryId: number | null;
        categoryName: string;
        statusId: number | null;
        statusName: string;
        statusColor: string | null;
        paymentMethodId: number | null;
        paymentMethodName: string;
        paymentReference: string;
        description: string;
        note: string;
        currency: string | null;
        taxCreditEligible: boolean;
        attachments: Record<string, unknown>[];
    } | null>;
    create(body: any): Promise<boolean>;
    update(body: any): Promise<boolean>;
    categories(): Prisma.PrismaPromise<{
        id: number;
        name: string;
    }[]>;
    createCategory(body: {
        name: string;
    }): Promise<boolean>;
    updateCategory(body: {
        id: number;
        name?: string;
    }): Promise<boolean>;
    deleteCategory(body: {
        id: number;
    }): Promise<boolean>;
    getAttachment(id: string, mode: string | undefined, res: FastifyReply): Promise<never>;
    deleteAttachment(id: string): Promise<{
        success: boolean;
    }>;
}
