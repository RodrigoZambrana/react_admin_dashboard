import { DepositRequirementType } from '@prisma/client';
export declare class OrderItemDto {
    productId: string;
    name: string;
    price: number;
    qty: number;
    img?: string;
    description?: string;
    comments?: string;
    specifications?: string;
    currency?: string;
    unitPrice?: number;
    unitCurrency?: string;
    customAttributes?: Record<string, unknown>;
    pricingMethod?: string;
}
export declare class AddressDto {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    street?: string;
    number?: string;
    corner?: string;
    apartment?: string;
}
export declare class ShippingDto {
    shippingVendor?: string;
    deliveryFees?: number;
    estimatedMin?: number;
    estimatedMax?: number;
}
export declare class CreateOrderDto {
    customerId: string;
    date?: string;
    paymentMehod: string;
    orderCurrency?: string;
    validUntilDate?: string;
    validUntil?: string;
    items: OrderItemDto[];
    shippingAddress: AddressDto;
    billingAddress: AddressDto;
    billingSameAsShipping: boolean;
    shipping: ShippingDto;
    comment?: string;
    disclaimer?: string;
    minimumDepositType?: DepositRequirementType;
    minimumDepositValue?: number;
}
