import { Prisma } from '@prisma/client';
export declare const SALE_MARKUP = 1.3;
export declare function decimalToNumber(value: unknown): number;
export declare function roundCurrency(value: Prisma.Decimal.Value): number;
export declare function salePriceFromCost(cost: number): number;
export declare function costPriceFromSale(sale: number): number;
export declare function derivePricingFromLegacyPrice(legacyPrice: number): {
    costPrice: number;
    salePrice: number;
};
export type OrderLineInput = {
    qty?: number | null;
    price?: unknown;
    product?: {
        salePrice?: unknown;
        costPrice?: unknown;
    } | null;
};
export declare function calculateOrderLineTotals(input: OrderLineInput): {
    saleTotal: number;
    costTotal: number;
};
