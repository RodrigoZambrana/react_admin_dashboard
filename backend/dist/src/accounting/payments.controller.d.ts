import { PaymentsService } from './payments.service';
import { PaymentListQueryDto, CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentsService);
    listPayments(query: PaymentListQueryDto): Promise<{
        data: {
            id: number;
            orderId: number;
            amount: number;
            currency: string;
            type: import(".prisma/client").$Enums.PaymentType;
            status: import(".prisma/client").$Enums.PaymentStatus;
            reference: string | null;
            method: string | null;
            paymentMethodId: number | null;
            date: string;
            notes: string | null;
            createdAt: string;
            updatedAt: string;
            attachments: {
                id: number;
                name: string;
                type: string | null;
                size: number | null;
                createdAt: string;
                url: string;
            }[];
            order: {
                id: number;
                customerId: number;
                customerName: string;
                grandTotal: number;
                currency: string;
                status: {
                    id: number;
                    code: number;
                    name: string;
                } | null;
            } | null;
        }[];
        total: number;
        pageIndex: number;
        pageSize: number;
    }>;
    getPayment(id: number): Promise<{
        summary: {
            currency: string;
            grandTotal: number;
            depositRequired: number;
            depositPaidConfirmed: number;
            balancePaidConfirmed: number;
            refundsConfirmed: number;
            totalPaidConfirmed: number;
            outstanding: number;
            customerCredit: number;
            depositMet: boolean;
        };
        id: number;
        orderId: number;
        amount: number;
        currency: string;
        type: import(".prisma/client").$Enums.PaymentType;
        status: import(".prisma/client").$Enums.PaymentStatus;
        reference: string | null;
        method: string | null;
        paymentMethodId: number | null;
        date: string;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        attachments: {
            id: number;
            name: string;
            type: string | null;
            size: number | null;
            createdAt: string;
            url: string;
        }[];
        order: {
            id: number;
            customerId: number;
            customerName: string;
            grandTotal: number;
            currency: string;
            status: {
                id: number;
                code: number;
                name: string;
            } | null;
        } | null;
    }>;
    createPayment(dto: CreatePaymentDto): Promise<{
        summary: {
            currency: string;
            grandTotal: number;
            depositRequired: number;
            depositPaidConfirmed: number;
            balancePaidConfirmed: number;
            refundsConfirmed: number;
            totalPaidConfirmed: number;
            outstanding: number;
            customerCredit: number;
            depositMet: boolean;
        };
        id: number;
        orderId: number;
        amount: number;
        currency: string;
        type: import(".prisma/client").$Enums.PaymentType;
        status: import(".prisma/client").$Enums.PaymentStatus;
        reference: string | null;
        method: string | null;
        paymentMethodId: number | null;
        date: string;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        attachments: {
            id: number;
            name: string;
            type: string | null;
            size: number | null;
            createdAt: string;
            url: string;
        }[];
        order: {
            id: number;
            customerId: number;
            customerName: string;
            grandTotal: number;
            currency: string;
            status: {
                id: number;
                code: number;
                name: string;
            } | null;
        } | null;
    }>;
    updatePayment(id: number, dto: UpdatePaymentDto): Promise<{
        summary: {
            currency: string;
            grandTotal: number;
            depositRequired: number;
            depositPaidConfirmed: number;
            balancePaidConfirmed: number;
            refundsConfirmed: number;
            totalPaidConfirmed: number;
            outstanding: number;
            customerCredit: number;
            depositMet: boolean;
        };
        id: number;
        orderId: number;
        amount: number;
        currency: string;
        type: import(".prisma/client").$Enums.PaymentType;
        status: import(".prisma/client").$Enums.PaymentStatus;
        reference: string | null;
        method: string | null;
        paymentMethodId: number | null;
        date: string;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        attachments: {
            id: number;
            name: string;
            type: string | null;
            size: number | null;
            createdAt: string;
            url: string;
        }[];
        order: {
            id: number;
            customerId: number;
            customerName: string;
            grandTotal: number;
            currency: string;
            status: {
                id: number;
                code: number;
                name: string;
            } | null;
        } | null;
    }>;
    deletePayment(id: number): Promise<boolean>;
    downloadAttachment(id: number, attachmentId: number): Promise<import("@nestjs/common").StreamableFile>;
    deleteAttachment(attachmentId: number): Promise<boolean>;
}
