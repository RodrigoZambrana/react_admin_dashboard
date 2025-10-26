import type { InboxMessageDirection } from '@prisma/client';
export type MessageIdentityInput = {
    provider: string;
    folder?: string | null;
    remoteId?: string | null;
    messageId?: string | null;
    gmailId?: string | null;
    headers?: Record<string, string> | undefined;
    bodyHtml?: string | null;
    bodyText?: string | null;
};
export type QueueClassificationInput = {
    headers?: Record<string, string> | undefined;
    to?: Array<{
        address?: string | null;
    }>;
    cc?: Array<{
        address?: string | null;
    }>;
    bcc?: Array<{
        address?: string | null;
    }>;
    from?: {
        address?: string | null;
    };
    labels?: string[];
    subject?: string | null;
    folder?: string | null;
    direction?: InboxMessageDirection;
};
export declare const DEFAULT_FOLDER = "INBOX";
export declare function normalizeFolder(folder?: string | null): string;
export declare function deriveMessageUid(input: MessageIdentityInput): string;
export declare function hashMessageBody(input: {
    bodyHtml?: string | null;
    bodyText?: string | null;
}): string | null;
