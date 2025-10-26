import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CurrencyConversionService } from '../common/currency/currency-conversion.service';
type ThemeConfigPayload = {
    themeColor: string;
    direction: 'ltr' | 'rtl';
    mode: 'light' | 'dark';
    primaryColorLevel: number;
    panelExpand: boolean;
    navMode: 'transparent' | 'light' | 'dark' | 'themed';
    cardBordered: boolean;
    layout: {
        type: 'classic' | 'modern' | 'stackedSide' | 'simple' | 'decked' | 'blank';
        sideNavCollapse: boolean;
    };
};
type BasicStatusConfig = {
    name: string;
    color?: string | null;
};
type OrderStatusConfig = BasicStatusConfig & {
    code?: number | null;
};
type NamedEntityConfig = {
    name: string;
};
type ShippingOptionConfig = {
    name: string;
    deliveryFees?: number | null;
    estimatedMin?: number | null;
    estimatedMax?: number | null;
    img?: string | null;
};
type CalendarEventTypeConfig = {
    name: string;
    color?: string | null;
    description?: string | null;
};
type ExchangeRateExport = {
    quote: string;
    rate: string;
    updatedAt: Date | null;
};
type SystemConfigExport = {
    taxRate: number;
    currencies: string[];
    currencyBase: string;
    exchangeRates: ExchangeRateExport[];
    themeConfig: ThemeConfigPayload;
};
type SettingsExportPayload = {
    meta: {
        exportedAt: string;
        version: number;
    };
    orderStatuses: OrderStatusConfig[];
    customerStatuses: BasicStatusConfig[];
    expenseStatuses: BasicStatusConfig[];
    expenseCategories: NamedEntityConfig[];
    productCategories: NamedEntityConfig[];
    paymentMethods: NamedEntityConfig[];
    shippingOptions: ShippingOptionConfig[];
    calendarEventTypes: CalendarEventTypeConfig[];
    systemConfig: SystemConfigExport;
    companyProfile: CompanyProfileResponse;
};
type SettingsImportPayload = Partial<Omit<SettingsExportPayload, 'meta'>> & {
    meta?: Partial<SettingsExportPayload['meta']>;
};
type CompanyProfileResponse = {
    legalName: string;
    tradeName: string;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    logo?: string | null;
};
type CompanyProfilePayload = {
    legalName?: unknown;
    tradeName?: unknown;
    taxId?: unknown;
    email?: unknown;
    phone?: unknown;
    website?: unknown;
    addressLine1?: unknown;
    addressLine2?: unknown;
    logo?: unknown;
};
import type { FastifyRequest } from 'fastify';
export declare class SettingsController {
    private prisma;
    private currencyConversion;
    constructor(prisma: PrismaService, currencyConversion: CurrencyConversionService);
    private readonly companySingletonKey;
    private readonly disclaimerConfigKey;
    private readonly defaultCalendarEventTypes;
    private readonly defaultOrderStatuses;
    private readonly defaultThemeConfig;
    private readonly defaultCompanyProfile;
    private readonly maxLogoSizeBytes;
    private mapCompanyProfile;
    private buildCompanyProfileData;
    private parseLogoInput;
    private toPrismaBytes;
    private prepareLogoForPersistence;
    private sanitizeThemeConfig;
    private parseNumber;
    private parseInteger;
    private normalizeColor;
    private normalizeOptionalColor;
    private sanitizeName;
    private parseOptionalNumber;
    private parseOptionalInteger;
    private ensureCalendarEventTypesSeeded;
    private ensureOrderStatusesSeeded;
    getCompanyProfile(): Promise<CompanyProfileResponse>;
    updateCompanyProfile(body: CompanyProfilePayload): Promise<CompanyProfileResponse>;
    getOrderStatuses(): Promise<{
        id: number;
        name: string;
        code: number;
        color: string | null;
    }[]>;
    createOrderStatus(body: {
        id?: number;
        name: string;
        color?: string;
    }): Promise<boolean>;
    updateOrderStatus(body: {
        id: number;
        name?: string;
        color?: string;
    }): Promise<boolean>;
    deleteOrderStatus(body: {
        id: number;
    }): Promise<boolean>;
    getCustomerStatuses(): Prisma.PrismaPromise<{
        id: number;
        name: string;
        color: string | null;
    }[]>;
    createCustomerStatus(body: {
        id?: number;
        name: string;
        color?: string;
    }): Promise<boolean>;
    updateCustomerStatus(body: {
        id: number | string;
        name?: string;
        color?: string;
    }): Promise<boolean>;
    deleteCustomerStatus(body: {
        id: number;
    }): Promise<boolean>;
    getExpenseStatuses(): Prisma.PrismaPromise<{
        id: number;
        name: string;
        color: string | null;
    }[]>;
    createExpenseStatus(body: {
        id?: number;
        name: string;
        color?: string;
    }): Promise<boolean>;
    updateExpenseStatus(body: {
        id: number;
        name?: string;
        color?: string;
    }): Promise<boolean>;
    deleteExpenseStatus(body: {
        id: number;
    }): Promise<boolean>;
    getProductCategories(): Prisma.PrismaPromise<{
        id: number;
        name: string;
    }[]>;
    createProductCategory(body: {
        name: string;
    }): Promise<boolean>;
    updateProductCategory(body: {
        id: number;
        name?: string;
    }): Promise<boolean>;
    deleteProductCategory(body: {
        id: number;
    }): Promise<boolean>;
    getPaymentMethods(): Prisma.PrismaPromise<{
        id: number;
        name: string;
    }[]>;
    createPaymentMethod(body: {
        name: string;
    }): Promise<boolean>;
    updatePaymentMethod(body: {
        id: number;
        name?: string;
    }): Promise<boolean>;
    deletePaymentMethod(body: {
        id: number;
    }): Promise<boolean>;
    getShippingOptions(): Prisma.PrismaPromise<{
        id: number;
        name: string;
        img: string | null;
        createdAt: Date;
        updatedAt: Date;
        deliveryFees: number | null;
        estimatedMin: number | null;
        estimatedMax: number | null;
    }[]>;
    createShippingOption(req: FastifyRequest): Promise<boolean>;
    updateShippingOption(req: FastifyRequest): Promise<boolean>;
    deleteShippingOption(body: {
        id: number | string;
    }): Promise<boolean>;
    exportConfigurations(): Promise<SettingsExportPayload>;
    importConfigurations(payload: SettingsImportPayload): Promise<{
        success: boolean;
        summary: Record<string, number>;
    }>;
    getSystemConfig(): Promise<{
        taxRate: number;
        currencies: string[];
        currencyBase: string;
        exchangeRates: {
            quote: string;
            rate: number;
            updatedAt: Date | null;
        }[];
        currencyOptions: import("../shared/currency").CurrencyDefinition[];
    }>;
    updateSystemConfig(body: {
        taxRate?: number;
        currencyBase?: string;
        currencies?: string[];
    }): Promise<boolean>;
    getSystemDisclaimer(): Promise<{
        html: string;
    }>;
    updateSystemDisclaimer(body: {
        html?: string | null;
    }): Promise<{
        html: string;
    }>;
    getThemeConfig(): Promise<ThemeConfigPayload>;
    updateThemeConfig(body: Partial<ThemeConfigPayload>): Promise<ThemeConfigPayload>;
    getCurrencies(): Promise<string[]>;
    getCurrencyOptions(): Promise<import("../shared/currency").CurrencyDefinition[]>;
    getExchangeRates(): Promise<{
        baseCurrency: string;
        rates: {
            quote: string;
            rate: number;
            updatedAt: Date;
        }[];
    }>;
    updateExchangeRates(body: {
        baseCurrency?: string;
        rates?: Array<{
            quote: string;
            rate: number;
        }>;
    }): Promise<{
        baseCurrency: string;
        rates: {
            quote: string;
            rate: number;
            updatedAt: Date;
        }[];
    }>;
    createCurrency(body: {
        code: string;
    }): Promise<string[]>;
    updateCurrency(body: {
        current: string;
        next: string;
    }): Promise<string[]>;
    deleteCurrency(body: {
        code: string;
    }): Promise<string[]>;
    getCalendarEventTypes(): Promise<{
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
        description: string | null;
    }[]>;
    createCalendarEventType(body: {
        name: string;
        color?: string;
        description?: string;
    }): Promise<{
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
        description: string | null;
    }>;
    updateCalendarEventType(id: string, body: {
        name?: string;
        color?: string;
        description?: string;
    }): Promise<{
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
        description: string | null;
    } | null>;
    deleteCalendarEventType(id: string): Promise<boolean>;
    countries(): {
        code: string;
        name: string;
    }[];
    cities(country?: string): {
        name: string;
    }[];
}
export {};
