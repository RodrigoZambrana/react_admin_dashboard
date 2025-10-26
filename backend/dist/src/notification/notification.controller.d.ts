import { PrismaService } from '../prisma/prisma.service';
export declare class NotificationController {
    private prisma;
    constructor(prisma: PrismaService);
    list(req: any): Promise<{
        id: string;
        target: string;
        description: string;
        date: string;
        image: string;
        type: number;
        location: string;
        locationLabel: string;
        status: string;
        readed: boolean;
    }[]>;
    count(req: any): Promise<{
        count: number;
    }>;
    markRead(id: string): Promise<boolean>;
}
