import { PrismaService } from '../prisma/prisma.service';
export declare class HealthController {
    private prisma;
    constructor(prisma: PrismaService);
    health(): Promise<{
        status: string;
        db: boolean;
        uptime: number;
        timestamp: string;
    }>;
}
