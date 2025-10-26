import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
export declare class UsersController {
    private prisma;
    constructor(prisma: PrismaService);
    list(): Promise<{
        name: string;
        lastName: string;
        role: import(".prisma/client").$Enums.Role;
        country: string | null;
        countryCode: string | null;
        city: string | null;
        id: number;
        email: string;
        img: string | null;
    }[]>;
    create(req: FastifyRequest): Promise<{
        name: string;
        lastName: string;
        role: import(".prisma/client").$Enums.Role;
        country: string | null;
        countryCode: string | null;
        city: string | null;
        id: number;
        email: string;
        img: string | null;
    }>;
    update(id: string, req: FastifyRequest): Promise<{
        name: string;
        lastName: string;
        role: import(".prisma/client").$Enums.Role;
        country: string | null;
        countryCode: string | null;
        city: string | null;
        id: number;
        email: string;
        img: string | null;
    }>;
    delete(id: string, req: FastifyRequest): Promise<{
        success: boolean;
    }>;
    updatePassword(id: string, body: {
        password?: unknown;
    }): Promise<{
        success: boolean;
    }>;
}
