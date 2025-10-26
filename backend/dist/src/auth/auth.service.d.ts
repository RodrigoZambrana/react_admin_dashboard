import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import type { Role } from './roles.decorator';
export declare class AuthService {
    private prisma;
    private jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    verifyRecaptcha(token: string | undefined | null, remoteIp?: string): Promise<void>;
    validateUser(email: string, pass: string): Promise<{
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
    }>;
    signToken(user: {
        id: number;
        email: string;
        role: Role;
        img?: string | null;
        name?: string | null;
        lastName?: string | null;
        lang?: string | null;
    }): {
        token: string;
        expiresAt: string;
        user: {
            authority: Role[];
            avatar: string;
            email: string;
            name: string;
            lastName: string;
            lang: string;
        };
    };
}
