import { PrismaService } from '../prisma/prisma.service';
import { DashboardFilterDto } from './dto/dashboard.dto';
type CurrencyKey = 'IUSD' | 'UYU' | 'OTHER';
type DashboardCurrencyBreakdown = Record<CurrencyKey, number>;
export declare class AccountingController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private startOfMonth;
    private monthKey;
    private toUnix;
    private roundCurrency;
    private extractCurrencyKey;
    private mergeCurrencyTotals;
    private emptyBreakdown;
    private sumBreakdown;
    private computeVat;
    dashboard(dto: DashboardFilterDto): Promise<{
        range: {
            start: number;
            end: number;
            granularity: "month";
        };
        monthly: {
            month: number;
            sales: number;
            expenses: number;
            taxes: number;
            netIncome: number;
            salesByCurrency: DashboardCurrencyBreakdown;
            expensesByCurrency: DashboardCurrencyBreakdown;
            taxesByCurrency: DashboardCurrencyBreakdown;
            netIncomeByCurrency: DashboardCurrencyBreakdown;
        }[];
        totals: {
            sales: number;
            expenses: number;
            taxes: number;
            balance: number;
            netIncome: number;
            salesByCurrency: DashboardCurrencyBreakdown;
            expensesByCurrency: DashboardCurrencyBreakdown;
            taxesByCurrency: DashboardCurrencyBreakdown;
            balanceByCurrency: DashboardCurrencyBreakdown;
            netIncomeByCurrency: DashboardCurrencyBreakdown;
        };
        currencySummary: {
            currency: CurrencyKey;
            sales: number;
            expenses: number;
            taxes: number;
            balance: number;
            liquidIncome: number;
        }[];
    }>;
}
export {};
