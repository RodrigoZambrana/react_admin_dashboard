import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto, ProductionOrderListQueryDto, UpdateProductionOrderDto } from './dto/production-order.dto';
export declare class ProductionOrdersController {
    private readonly productionOrders;
    constructor(productionOrders: ProductionOrdersService);
    list(query: ProductionOrderListQueryDto): Promise<{
        data: {
            id: number;
            orderId: number;
            workOrderId: number;
            status: import(".prisma/client").$Enums.WorkOrderStatus;
            priority: number;
            assignedToId: number | null;
            scheduledAt: string | null;
            startedAt: string | null;
            completedAt: string | null;
            deliveredAt: string | null;
            notes: string | null;
            metadata: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | null;
            createdAt: string;
            updatedAt: string;
            workOrder: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                status: import(".prisma/client").$Enums.WorkOrderStatus;
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number;
                notes: string | null;
                issuedAt: Date;
                startedAt: Date | null;
                completedAt: Date | null;
                deliveredAt: Date | null;
                closedAt: Date | null;
            };
            order: {
                id: number;
                code: string;
                customer: {
                    id: number;
                    name: string;
                } | null;
            };
            assignedTo: {
                id: number;
                name: string | null;
                lastName: string | null;
            } | null;
        }[];
        total: number;
        pageIndex: number;
        pageSize: number;
    }>;
    summary(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        overdue: number;
    }>;
    stats(): Promise<{
        labels: string[];
        created: number[];
        completed: number[];
    }>;
    findOne(id: number): Promise<{
        id: number;
        orderId: number;
        workOrderId: number;
        status: import(".prisma/client").$Enums.WorkOrderStatus;
        priority: number;
        assignedToId: number | null;
        scheduledAt: string | null;
        startedAt: string | null;
        completedAt: string | null;
        deliveredAt: string | null;
        notes: string | null;
        metadata: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | null;
        createdAt: string;
        updatedAt: string;
        workOrder: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            status: import(".prisma/client").$Enums.WorkOrderStatus;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            orderId: number;
            notes: string | null;
            issuedAt: Date;
            startedAt: Date | null;
            completedAt: Date | null;
            deliveredAt: Date | null;
            closedAt: Date | null;
        };
        order: {
            id: number;
            code: string;
            customer: {
                id: number;
                name: string;
            } | null;
        };
        assignedTo: {
            id: number;
            name: string | null;
            lastName: string | null;
        } | null;
    }>;
    create(dto: CreateProductionOrderDto): Promise<{
        id: number;
        orderId: number;
        workOrderId: number;
        status: import(".prisma/client").$Enums.WorkOrderStatus;
        priority: number;
        assignedToId: number | null;
        scheduledAt: string | null;
        startedAt: string | null;
        completedAt: string | null;
        deliveredAt: string | null;
        notes: string | null;
        metadata: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | null;
        createdAt: string;
        updatedAt: string;
        workOrder: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            status: import(".prisma/client").$Enums.WorkOrderStatus;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            orderId: number;
            notes: string | null;
            issuedAt: Date;
            startedAt: Date | null;
            completedAt: Date | null;
            deliveredAt: Date | null;
            closedAt: Date | null;
        };
        order: {
            id: number;
            code: string;
            customer: {
                id: number;
                name: string;
            } | null;
        };
        assignedTo: {
            id: number;
            name: string | null;
            lastName: string | null;
        } | null;
    }>;
    update(id: number, dto: UpdateProductionOrderDto): Promise<{
        id: number;
        orderId: number;
        workOrderId: number;
        status: import(".prisma/client").$Enums.WorkOrderStatus;
        priority: number;
        assignedToId: number | null;
        scheduledAt: string | null;
        startedAt: string | null;
        completedAt: string | null;
        deliveredAt: string | null;
        notes: string | null;
        metadata: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | null;
        createdAt: string;
        updatedAt: string;
        workOrder: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            status: import(".prisma/client").$Enums.WorkOrderStatus;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            orderId: number;
            notes: string | null;
            issuedAt: Date;
            startedAt: Date | null;
            completedAt: Date | null;
            deliveredAt: Date | null;
            closedAt: Date | null;
        };
        order: {
            id: number;
            code: string;
            customer: {
                id: number;
                name: string;
            } | null;
        };
        assignedTo: {
            id: number;
            name: string | null;
            lastName: string | null;
        } | null;
    }>;
    remove(id: number): Promise<boolean>;
}
