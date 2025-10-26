import { WorkOrderStatus } from '@prisma/client';
export declare class ProductionOrderListQueryDto {
    pageIndex?: number;
    pageSize?: number;
    search?: string;
    orderId?: number;
    status?: WorkOrderStatus;
    assignedToId?: number;
    priority?: number;
    sortKey?: 'createdAt' | 'scheduledAt';
    sortOrder?: 'asc' | 'desc';
}
export declare class CreateProductionOrderDto {
    orderId: number;
    workOrderId?: number;
    status?: WorkOrderStatus;
    priority?: number;
    assignedToId?: number | null;
    scheduledAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    deliveredAt?: string | null;
    notes?: string | null;
    metadata?: string | null;
}
export declare class UpdateProductionOrderDto {
    status?: WorkOrderStatus;
    priority?: number;
    assignedToId?: number | null;
    scheduledAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    deliveredAt?: string | null;
    notes?: string | null;
    metadata?: string | null;
}
