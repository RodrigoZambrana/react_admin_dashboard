import { PrismaService } from '../prisma/prisma.service';
import { FastifyReply } from 'fastify';
export declare class CalendarController {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly defaultEventTypes;
    private ensureEventTypesSeeded;
    private mergeEventMetadata;
    private decodeAttachmentContent;
    private toPrismaBytes;
    private extractAttachmentPayload;
    private serializeAttachments;
    private serializeComments;
    private normalizeEvent;
    private resolveEventType;
    events(start?: string, end?: string, projectId?: string, createdById?: string, taskId?: string): Promise<{
        events: any[];
    }>;
    activity(id?: string): Promise<any>;
    createEvent(body: any, req: any): Promise<any>;
    updateEvent(id: string, body: any): Promise<any>;
    deleteEvent(id: string): Promise<boolean>;
    getAttachment(id: string, mode: string | undefined, res: FastifyReply): Promise<never>;
    deleteAttachment(id: string): Promise<{
        success: boolean;
    }>;
    addComment(id: string, message: string, req: any): Promise<{
        id: number;
        message: string;
        createdAt: Date;
        author: {
            id: number;
            name: string | null;
            email: string;
            img: string | null | undefined;
        } | null;
    }>;
    deleteComment(id: string, req: any): Promise<{
        success: boolean;
    }>;
    updateComment(id: string, message: string, req: any): Promise<{
        id: number;
        message: string;
        createdAt: Date;
        author: {
            id: number;
            name: string | null;
            email: string;
            img: string | null | undefined;
        } | null;
    }>;
}
