import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
import { UserActivityService } from '../user-activity/user-activity.service';
export declare class AccountController {
    private readonly prisma;
    private readonly userActivity;
    private readonly activityPageSize;
    private readonly companySingletonKey;
    private readonly defaultCompanyProfile;
    constructor(prisma: PrismaService, userActivity: UserActivityService);
    private extractUserId;
    private startOfDay;
    private dateKey;
    private formatActivityType;
    private mapCompanyProfile;
    private normalizeFilterTypes;
    private normalizeMetadataResponse;
    private resolveUserName;
    private resolveDeviceType;
    private buildLoginHistory;
    private buildActivityWhere;
    private buildActivityGroups;
    setting(req: FastifyRequest): Promise<{
        profile: {
            email: string;
            firstName: string;
            name: string;
            lastName: string;
            avatar: string;
            lang: string;
        };
        loginHistory: {
            type: string;
            deviceName: string;
            time: number;
            location: string;
        }[];
    }>;
    integration(): {
        providers: never[];
    };
    billing(): {
        plans: never[];
    };
    invoice(id: string): Promise<{
        id: string;
        address: string[];
        items: never[];
        company: {
            legalName: string;
            tradeName: string;
            taxId: string | null;
            email: string | null;
            phone: string | null;
            website: string | null;
            addressLine1: string | null;
            addressLine2: string | null;
            logo: string | null;
        };
    }>;
    log(req: FastifyRequest, body: {
        filter?: string[];
        activityIndex?: number;
    }): Promise<{
        data: {
            id: string;
            date: number;
            events: Array<{
                type: string;
                dateTime: number;
                userName: string;
                userImg?: string;
                description?: string;
                metadata?: Record<string, string>;
            }>;
        }[];
        loadable: boolean;
    }>;
    form(): {
        kyc: {};
    };
    updatePassword(req: FastifyRequest, body: {
        password?: string;
        newPassword?: string;
    }): Promise<{
        ok: boolean;
    }>;
    updateProfile(req: FastifyRequest): Promise<{
        profile: {
            firstName: string;
            lastName: string;
            name: string;
            email: string;
            avatar: string;
            lang: string;
        };
        user: {
            email: string;
            avatar: string;
            authority: import(".prisma/client").$Enums.Role[];
            name: string;
            lastName: string;
            lang: string;
        };
    }>;
    updateLanguage(req: FastifyRequest, body: {
        lang?: string;
    }): Promise<{
        lang: string;
    }>;
}
