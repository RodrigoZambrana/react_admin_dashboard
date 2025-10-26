import { Prisma } from '@prisma/client';
export type Decimalish = Prisma.Decimal.Value | null | undefined;
export declare function decimal(value: Decimalish): Prisma.Decimal;
export declare function roundDecimal(value: Decimalish, scale?: number): Prisma.Decimal;
export declare function addDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal;
export declare function subtractDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal;
export declare function multiplyDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal;
export declare function divideDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal;
export declare function decimalToNumber(value: Decimalish, scale?: number): number;
