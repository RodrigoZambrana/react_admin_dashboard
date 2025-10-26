import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
import { UserActivityService } from '../user-activity/user-activity.service';
export declare class AuthController {
    private auth;
    private prisma;
    private userActivity;
    constructor(auth: AuthService, prisma: PrismaService, userActivity: UserActivityService);
    private buildAuthCookieOptions;
    signIn(dto: SignInDto, req: FastifyRequest, reply: FastifyReply): Promise<{
        user: {
            avatar: string;
            authority: import("./roles.decorator").Role[];
            email: string;
            name: string;
            lastName: string;
            lang: string;
        };
        token: string;
        expiresAt: string;
    }>;
    signUp(dto: SignUpDto, req: FastifyRequest, reply: FastifyReply): Promise<{
        user: {
            avatar: string;
            authority: import("./roles.decorator").Role[];
            email: string;
            name: string;
            lastName: string;
            lang: string;
        };
        token: string;
        expiresAt: string;
    }>;
    signOut(reply: FastifyReply): Promise<{
        ok: boolean;
    }>;
    forgotPassword(): Promise<{
        ok: boolean;
    }>;
    resetPassword(): Promise<{
        ok: boolean;
    }>;
}
