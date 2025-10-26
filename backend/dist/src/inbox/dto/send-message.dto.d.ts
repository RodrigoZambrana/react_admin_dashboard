export declare class SendMessageAttachmentDto {
    fileName: string;
    contentType?: string;
    content: string;
}
export declare class SendMessageDto {
    subject: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string[];
    replyToRemoteId?: string;
    bodyHtml?: string;
    bodyText?: string;
    attachments?: SendMessageAttachmentDto[];
    metadata?: Record<string, unknown>;
    fromAddress?: string;
    fromName?: string;
    queueId?: string;
    queueSlug?: string;
}
