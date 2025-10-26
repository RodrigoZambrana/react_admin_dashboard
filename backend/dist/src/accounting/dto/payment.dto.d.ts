import { PaymentStatus, PaymentType } from '@prisma/client';
export declare class PaymentListQueryDto {
    pageIndex?: number;
    pageSize?: number;
    query?: string;
    orderId?: number;
    status?: PaymentStatus;
    type?: PaymentType;
    startDate?: string;
    endDate?: string;
    sortKey?: 'date' | 'amount' | 'status' | 'type' | 'order';
    sortOrder?: 'asc' | 'desc';
}
export declare class PaymentBaseDto {
    paymentMethodId?: number | null;
    method?: string | null;
    reference?: string | null;
    notes?: string | null;
    type?: PaymentType;
    status?: PaymentStatus;
    date?: string;
    currency?: string;
}
export declare class PaymentAttachmentDto {
    id?: number;
    name: string;
    type?: string | null;
    size?: number | null;
    content?: string | null;
}
export declare class CreatePaymentDto extends PaymentBaseDto {
    orderId: number;
    amount: number;
    attachments?: PaymentAttachmentDto[];
}
export declare class UpdatePaymentDto extends PaymentBaseDto {
    amount?: number;
    attachments?: PaymentAttachmentDto[];
}
