import { StreamableFile } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SalesDocumentsService } from './sales-documents.service';
import { CreateOrderDto } from '../sales/dto/order.dto';
export declare class OrdersController {
    private readonly documents;
    constructor(documents: SalesDocumentsService);
    listOrders(q: any): Promise<{
        data: {
            id: string;
            date: number;
            validUntilDate: string | null;
            validityDate: string | null;
            customer: string;
            status: number;
            paymentMehod: string;
            paymentIdendifier: string;
            totalAmount: number;
            orderCurrency: string;
        }[];
        total: number;
    }>;
    exportOrders(q: any): Promise<StreamableFile>;
    importOrders(req: FastifyRequest): Promise<{
        imported: number;
        errors: {
            row: number;
            message: string;
        }[];
    }>;
    deleteOrders(body: {
        id: string | string[];
    }): Promise<boolean>;
    getOrderDetails(id: number): Promise<{
        id: number;
        date: Date;
        validUntilDate: string | null;
        validityDate: string | null;
        customer: {
            previousOrder: number;
            previousBudgets: number;
            id: number;
            email: string | null;
            name: string;
            lastName: string | null;
            img: string | null;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            location: string | null;
            title: string | null;
            phoneNumber: string | null;
            birthday: Date | null;
            facebook: string | null;
            twitter: string | null;
            pinterest: string | null;
            linkedIn: string | null;
            statusId: number | null;
        } | null;
        items: {
            price: number;
            unitAmount: number | null;
            unitAmountOrderCurrency: number | null;
            conversionRate: number | null;
            unitCostAmount: number | null;
            unitCostOrderCurrency: number | null;
            unitCurrency: string | null;
            unitCostCurrency: string | null;
            comments: string | null;
            product: {
                id: number;
                name: string;
                img: string | null;
                createdAt: Date;
                updatedAt: Date;
                taxRate: number | null;
                status: number;
                productCode: string | null;
                description: string | null;
                specifications: string | null;
                categoryId: number | null;
                salePrice: import("@prisma/client/runtime/library").Decimal;
                costPrice: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                unitOfMeasure: import(".prisma/client").$Enums.SalesUnit;
                stock: number;
                permanentStock: boolean;
                costPerItem: number | null;
                bulkDiscountPrice: number | null;
                tags: string[];
                brand: string | null;
                vendor: string | null;
                published: boolean;
            } | null;
            id: number;
            name: string;
            img: string | null;
            description: string | null;
            qty: number;
            customAttributes: import("@prisma/client/runtime/library").JsonValue | null;
            pricingMethodSnapshot: import(".prisma/client").$Enums.SalesUnit | null;
            unitPriceSnapshot: import("@prisma/client/runtime/library").Decimal | null;
            skuSnapshot: string | null;
            nameSnapshot: string | null;
            specSummary: string | null;
            specJson: import("@prisma/client/runtime/library").JsonValue | null;
            productId: number | null;
            orderId: number;
        }[];
        paymentMethod: {
            id: number;
            name: string;
        } | null;
        status: {
            id: number;
            name: string;
            code: number;
            color: string | null;
        } | null;
        subTotal: number;
        tax: number;
        deliveryFees: number | null;
        grandTotal: number;
        documentFilePath: string | null;
        documentFileName: string | null;
        documentFileMime: string | null;
        documentFileSize: number | null;
        documentGeneratedAt: Date | null;
        orderCurrency: string;
        fxBase: string | null;
        fxRates: import("@prisma/client/runtime/library").JsonValue;
        comment: string | null;
        billingSameAsShipping: boolean;
        shippingAddress1: string | null;
        shippingAddress2: string | null;
        shippingCity: string | null;
        shippingState: string | null;
        shippingZip: string | null;
        billingAddress1: string | null;
        billingAddress2: string | null;
        billingCity: string | null;
        billingState: string | null;
        billingZip: string | null;
        shippingVendor: string | null;
        estimatedMin: number | null;
        estimatedMax: number | null;
        disclaimer: string | null;
        minimumDepositType: import(".prisma/client").$Enums.DepositRequirementType;
        minimumDepositValue: number;
        customerCredit: number;
        confirmedAt: string | null;
        depositSatisfiedAt: string | null;
        payments: {
            summary: {
                currency: string;
                depositRequired: number;
                depositPaidConfirmed: number;
                balancePaidConfirmed: number;
                refundsConfirmed: number;
                totalPaidConfirmed: number;
                depositPending: number;
                balancePending: number;
                refundsPending: number;
                outstanding: number;
                customerCredit: number;
                depositMet: boolean;
            } | null;
            records: {
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
            }[];
        };
    } | null>;
    getOrderPdf(id: number): Promise<StreamableFile>;
    createOrder(dto: CreateOrderDto): Promise<boolean>;
    replaceOrder(id: number, dto: CreateOrderDto): Promise<boolean>;
    updateOrderComment(id: number, body: {
        comment?: string;
    }): Promise<boolean>;
    updateOrderStatus(id: number, body: {
        status: number;
        force?: boolean;
    }): Promise<boolean>;
    updateOrderPaymentMethod(id: number, body: {
        paymentMehod?: string | number | null;
    }): Promise<boolean>;
    uploadOrderDocument(id: number, req: FastifyRequest): Promise<{
        path: string | null;
        name: string | null;
        mime: string | null;
        size: number | null;
        generatedAt: string | null;
    }>;
}
