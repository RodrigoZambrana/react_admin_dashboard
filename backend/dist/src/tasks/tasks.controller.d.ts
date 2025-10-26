import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TableQueryDto } from '../customers/dto/table-query.dto';
export declare class TasksController {
    private prisma;
    constructor(prisma: PrismaService);
    list(dto: TableQueryDto & {
        projectId?: number;
        createdById?: number;
    }): Promise<{
        data: ({
            project: {
                id: number;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                code: string | null;
                description: string | null;
                startDate: Date | null;
                endDate: Date | null;
            } | null;
            assignees: ({
                user: {
                    id: number;
                    email: string;
                    name: string | null;
                    lastName: string | null;
                    img: string | null;
                    role: import(".prisma/client").$Enums.Role;
                    lang: string;
                    country: string | null;
                    countryCode: string | null;
                    city: string | null;
                    passwordHash: string;
                    createdAt: Date;
                    updatedAt: Date;
                };
            } & {
                taskId: number;
                userId: number;
            })[];
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            status: string | null;
            description: string | null;
            subject: string;
            priority: number;
            dueDate: Date | null;
            projectId: number | null;
            createdById: number | null;
        })[];
        total: number;
    }>;
    detail(id: string): Promise<({
        events: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            color: string | null;
            location: string | null;
            title: string;
            description: string | null;
            projectId: number | null;
            createdById: number | null;
            taskId: number | null;
            type: import(".prisma/client").$Enums.EventType;
            startAt: Date;
            endAt: Date | null;
            allDay: boolean;
            metadata: Prisma.JsonValue | null;
            eventTypeId: number | null;
        }[];
        project: {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            description: string | null;
            startDate: Date | null;
            endDate: Date | null;
        } | null;
        assignees: ({
            user: {
                id: number;
                email: string;
                name: string | null;
                lastName: string | null;
                img: string | null;
                role: import(".prisma/client").$Enums.Role;
                lang: string;
                country: string | null;
                countryCode: string | null;
                city: string | null;
                passwordHash: string;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            taskId: number;
            userId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        status: string | null;
        description: string | null;
        subject: string;
        priority: number;
        dueDate: Date | null;
        projectId: number | null;
        createdById: number | null;
    }) | null>;
    create(body: any, req: any): Promise<{
        assignees: {
            taskId: number;
            userId: number;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        status: string | null;
        description: string | null;
        subject: string;
        priority: number;
        dueDate: Date | null;
        projectId: number | null;
        createdById: number | null;
    }>;
    update(id: string, body: any): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        status: string | null;
        description: string | null;
        subject: string;
        priority: number;
        dueDate: Date | null;
        projectId: number | null;
        createdById: number | null;
    }>;
    delete(id: string): Promise<boolean>;
}
