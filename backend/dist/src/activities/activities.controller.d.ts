import { PrismaService } from '../prisma/prisma.service';
export declare class ActivitiesController {
    private prisma;
    constructor(prisma: PrismaService);
    private buildBoardResponse;
    getBoard(): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    getMembers(): Promise<{
        participantMembers: {
            id: number;
            name: string;
            email: string;
            img: string;
        }[];
        allMembers: {
            id: number;
            name: string;
            email: string;
            img: string;
        }[];
    }>;
    createColumn(body: {
        title: string;
    }): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    reorderColumns(body: {
        columnIds: number[];
    }): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    updateColumn(id: number, body: {
        title?: string;
    }): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    deleteColumn(id: number): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    createTicket(body: {
        columnId: number;
        name: string;
        description?: string;
        priority?: string;
        labels?: string[];
        dueDate?: string | number | null;
        memberIds?: number[];
    }): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    reorderTickets(body: {
        columnOrders: {
            columnId: number;
            ticketIds: number[];
        }[];
    }): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    updateTicket(id: number, body: {
        columnId?: number;
        name?: string;
        description?: string | null;
        priority?: string | null;
        labels?: string[];
        dueDate?: string | number | null;
        memberIds?: number[];
        order?: number;
    }): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
    deleteTicket(id: number): Promise<{
        ordered: number[];
        columns: {
            id: number;
            title: string;
            sortOrder: number;
            tickets: {
                id: number;
                columnId: number;
                name: string;
                description: string | null;
                priority: string | null;
                labels: string[];
                dueDate: number | null;
                order: number;
                cover: string | null;
                members: {
                    id: number;
                    name: string;
                    email: string;
                    img: string;
                }[];
            }[];
        }[];
    }>;
}
