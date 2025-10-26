import { StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertProductDto, UpdateProductDto, TableQueryDto as ProductQuery } from './dto/product.dto';
import { DashboardFilterDto } from './dto/dashboard.dto';
import type { FastifyRequest } from 'fastify';
export declare class SalesController {
    private prisma;
    constructor(prisma: PrismaService);
    private getTaxRate;
    private deriveInventoryStatus;
    private startOfDay;
    private dayKey;
    private formatCsvValue;
    private buildCsv;
    private normalizeProductSortKey;
    private normalizeSortDirection;
    private buildProductOrderBy;
    private buildProductWhere;
    private normalizeHeaderKey;
    private parseCsv;
    private getCell;
    private parseNumber;
    private parseDate;
    private parseOptionalBoolean;
    private parseSalesUnit;
    private normalizeOptionalString;
    private splitTags;
    private resolveCategoryId;
    private resolveCustomer;
    private resolvePaymentMethod;
    private resolveStatus;
    dashboard(dto: DashboardFilterDto): Promise<{
        statisticData: {
            orders: {
                value: number;
                growShrink: number;
            };
            revenue: {
                value: number;
                growShrink: number;
            };
            netIncome: {
                value: number;
                growShrink: number;
            };
        };
        salesReportData: {
            series: {
                name: string;
                data: number[];
            }[];
            categories: number[];
            granularity: "day" | "hour" | "month";
        };
        topProductsData: {
            id: string;
            name: string;
            img: string;
            sold: number;
            specifications: any;
        }[];
        latestOrderData: {
            id: string;
            date: number;
            customer: string;
            status: number;
            paymentMehod: string;
            paymentIdendifier: string;
            totalAmount: Prisma.Decimal;
        }[];
        salesByCategoriesData: {
            labels: string[];
            data: number[];
        };
    }>;
    listProducts(dto: ProductQuery): Promise<{
        data: {
            id: string;
            name: string;
            productCode: string;
            img: string;
            category: any;
            salePrice: number;
            costPrice: number;
            currency: string;
            unitOfMeasure: import(".prisma/client").$Enums.SalesUnit;
            stock: number;
            permanentStock: boolean;
            status: 0 | 1 | 2;
            published: boolean;
            tags: any;
            brand: string;
            vendor: string;
            specifications: string;
        }[];
        total: number;
    }>;
    exportProducts(dto: ProductQuery): Promise<StreamableFile>;
    importProducts(req: FastifyRequest): Promise<{
        success: boolean;
        imported: number;
        created: number;
        updated: number;
        failed: number;
        errors: {
            row: number;
            message: string;
        }[];
    }>;
    getProduct(id: string): Promise<{
        salePrice: number;
        costPrice: number;
        category: {
            id: number;
            name: string;
        } | null;
        images: {
            id: number;
            name: string | null;
            img: string;
            sortOrder: number;
            productId: number;
        }[];
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
    } | null>;
    createProduct(dto: UpsertProductDto): Promise<boolean>;
    updateProduct(dto: UpdateProductDto): Promise<boolean>;
    deleteProducts(body: {
        id: string | string[];
    }): Promise<boolean>;
}
