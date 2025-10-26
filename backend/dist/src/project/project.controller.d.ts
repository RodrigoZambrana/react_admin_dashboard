import { PrismaService } from '../prisma/prisma.service';
export declare class ProjectController {
    private prisma;
    constructor(prisma: PrismaService);
    dashboard(): Promise<{
        taskCount: number;
        projectOverviewData: {
            chart: {
                daily: {
                    onGoing: number;
                    finished: number;
                    total: number;
                    series: {
                        name: string;
                        data: number[];
                    }[];
                    range: string[];
                };
                weekly: {
                    onGoing: number;
                    finished: number;
                    total: number;
                    series: {
                        name: string;
                        data: number[];
                    }[];
                    range: string[];
                };
                monthly: {
                    onGoing: number;
                    finished: number;
                    total: number;
                    series: {
                        name: string;
                        data: number[];
                    }[];
                    range: string[];
                };
            };
        };
        myTasksData: {
            taskId: string;
            taskSubject: string;
            priority: number;
            assignees: {
                id: string;
                name: string;
                email: string;
                img: string;
            }[];
        }[];
        scheduleData: {
            id: string;
            time: string;
            eventName: string;
            desciption: string;
            type: import(".prisma/client").$Enums.EventType;
        }[];
        activitiesData: never[];
        projectsData: {
            id: number;
            name: string;
            category: string;
            desc: string;
            attachmentCount: number;
            totalTask: number;
            completedTask: number;
            progression: number;
            dayleft: number;
            status: string;
            member: {
                name: string;
                img: string;
            }[];
        }[];
    }>;
    list(body: {
        sort?: 'asc' | 'desc';
        search?: string;
    }): Promise<{
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        description: string | null;
        startDate: Date | null;
        endDate: Date | null;
    }[]>;
    add(body: {
        id?: number;
        name: string;
        category?: string;
        desc?: string;
    }): Promise<boolean>;
    boards(): {
        boards: never[];
    };
    members(): {
        members: never[];
    };
    ticketDetail(): {
        id: string;
        subject: string;
    };
}
