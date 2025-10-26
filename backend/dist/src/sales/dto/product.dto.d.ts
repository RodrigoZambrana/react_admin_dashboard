import { SalesUnit } from '@prisma/client';
declare class ProductImagePayload {
    id: string;
    name?: string;
    img: string;
}
declare class ProductSortDto {
    key?: string;
    order?: 'asc' | 'desc' | '';
}
export declare class UpsertProductDto {
    id?: number;
    name: string;
    productCode?: string;
    img?: string;
    description?: string;
    specifications?: string;
    categoryId: number;
    costPrice: number;
    salePrice: number;
    currency?: string;
    unitOfMeasure?: SalesUnit;
    stock: number;
    permanentStock?: boolean;
    costPerItem?: number;
    bulkDiscountPrice?: number;
    tags?: string[] | {
        label: string;
        value: string;
    }[];
    brand?: string;
    vendor?: string;
    published?: boolean;
    imgList?: ProductImagePayload[];
}
export declare class UpdateProductDto {
    id: number;
    name?: string;
    productCode?: string;
    img?: string;
    description?: string;
    specifications?: string;
    categoryId?: number;
    costPrice?: number;
    salePrice?: number;
    currency?: string;
    unitOfMeasure?: SalesUnit;
    stock?: number;
    permanentStock?: boolean;
    costPerItem?: number;
    bulkDiscountPrice?: number;
    tags?: string[] | {
        label: string;
        value: string;
    }[];
    brand?: string;
    vendor?: string;
    published?: boolean;
    imgList?: ProductImagePayload[];
}
export declare class TableQueryDto {
    pageIndex: number;
    pageSize: number;
    query?: string;
    sort?: ProductSortDto;
    filterData?: any;
}
export {};
