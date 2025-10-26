import { PrismaService } from '../prisma/prisma.service';
import type { FastifyRequest } from 'fastify';
export declare class UserActivityService {
    private prisma;
    constructor(prisma: PrismaService);
    recordLogin(userId: number, req: FastifyRequest): Promise<void>;
    recordProfileUpdate(userId: number, updatedFields: string[], req?: FastifyRequest): Promise<void>;
    recordPasswordChange(userId: number, method: string, req: FastifyRequest): Promise<void>;
    private logActivity;
    private ensureDevice;
    private extractClientContext;
    private getHeader;
    private resolveDevice;
    private computeFingerprint;
    private normalizeMetadata;
}
