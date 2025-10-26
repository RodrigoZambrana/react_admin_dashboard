import { Prisma, CurrencyRate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type StandardCurrencyOption } from './currency.constants';
type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;
export type CurrencyRatesSnapshot = {
    base: string;
    rates: Record<string, Prisma.Decimal>;
    generatedAt: string;
};
export type CurrencyConversionResult = {
    amount: Prisma.Decimal;
    rate: Prisma.Decimal;
};
export declare class CurrencyConversionService {
    private readonly prisma;
    private readonly fallbackCurrencies;
    constructor(prisma: PrismaService);
    private isPrismaService;
    private withTransaction;
    getStandardCurrencies(): StandardCurrencyOption[];
    normalizeCurrency(code: unknown): string | null;
    getEnabledCurrencies(): Promise<string[]>;
    setEnabledCurrencies(codes: string[], client?: PrismaClientOrTx): Promise<string[]>;
    getBaseCurrency(): Promise<string>;
    setBaseCurrency(code: string, client?: PrismaClientOrTx): Promise<string>;
    listRates(base?: string): Promise<CurrencyRate[]>;
    replaceRates(base: string, entries: Array<{
        quote: string;
        rate: Prisma.Decimal.Value;
    }>, client?: PrismaClientOrTx): Promise<CurrencyRate[]>;
    buildRatesSnapshot(requiredCurrencies: string[]): Promise<CurrencyRatesSnapshot>;
    convertWithSnapshot(amount: Prisma.Decimal.Value, fromCurrency: string, toCurrency: string, snapshot: CurrencyRatesSnapshot, options?: {
        amountScale?: number;
        rateScale?: number;
    }): CurrencyConversionResult;
}
export {};
