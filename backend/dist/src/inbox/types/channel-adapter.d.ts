import { InboxChannelType, InboxMessageDirection } from '@prisma/client';
export type ChannelAccount = {
    id: string;
    address?: string | null;
    displayName?: string | null;
    metadata?: Record<string, unknown> | null;
};
export type ChannelMailbox = {
    id: string;
    label: string;
    type?: 'inbox' | 'sent' | 'spam' | 'trash' | 'drafts' | 'archive' | 'custom';
    unreadCount?: number;
    metadata?: Record<string, unknown>;
};
export type ChannelMessageListItem = {
    remoteId: string;
    threadRemoteId?: string | null;
    subject?: string | null;
    snippet?: string | null;
    previewText?: string | null;
    from?: {
        name?: string | null;
        address?: string | null;
    };
    to?: {
        name?: string | null;
        address?: string | null;
    }[];
    cc?: {
        name?: string | null;
        address?: string | null;
    }[];
    bcc?: {
        name?: string | null;
        address?: string | null;
    }[];
    direction: InboxMessageDirection;
    folder?: string | null;
    sentAt?: Date | null;
    receivedAt?: Date | null;
    isRead?: boolean;
    isStarred?: boolean;
    isSpam?: boolean;
    hasAttachments?: boolean;
    metadata?: Record<string, unknown> | null;
};
export type ChannelListMessagesOptions = {
    mailbox: string;
    cursor?: string | null;
    limit?: number;
    since?: Date;
    includeThread?: boolean;
};
export type ChannelListMessagesResult = {
    messages: ChannelMessageListItem[];
    nextCursor?: string | null;
};
export type ChannelMessageIdentifier = {
    remoteId: string;
    threadRemoteId?: string | null;
};
export type ChannelMessageAttachment = {
    remoteId?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    size?: number | null;
    inline?: boolean;
    contentId?: string | null;
};
export type ChannelMessageBody = {
    remoteId: string;
    threadRemoteId?: string | null;
    subject?: string | null;
    bodyHtml?: string | null;
    bodyText?: string | null;
    attachments: ChannelMessageAttachment[];
    headers?: Record<string, string>;
    metadata?: Record<string, unknown> | null;
};
export type ChannelAttachmentContent = {
    remoteId?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    size?: number | null;
    data: Buffer;
};
export type ChannelSendAttachmentInput = {
    fileName: string;
    contentType?: string;
    content: Buffer;
    encoding?: 'base64' | 'binary';
};
export type ChannelSendMessageInput = {
    subject: string;
    from?: {
        address: string;
        name?: string;
    };
    body: {
        html?: string;
        text?: string;
    };
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string[];
    replyToRemoteId?: string;
    attachments?: ChannelSendAttachmentInput[];
    metadata?: Record<string, unknown>;
};
export type ChannelSendMessageResult = {
    remoteId: string;
    threadRemoteId?: string | null;
    accepted: string[];
    rejected: string[];
    metadata?: Record<string, unknown> | null;
};
export type ChannelSetFlagsInput = {
    seen?: boolean;
    starred?: boolean;
    spam?: boolean;
    metadata?: Record<string, unknown>;
};
export interface ChannelAdapter {
    readonly type: InboxChannelType;
    listMailboxes(account: ChannelAccount): Promise<ChannelMailbox[]>;
    listMessages(account: ChannelAccount, options: ChannelListMessagesOptions): Promise<ChannelListMessagesResult>;
    getMessage(account: ChannelAccount, identifier: ChannelMessageIdentifier): Promise<ChannelMessageBody>;
    getAttachmentContent?(account: ChannelAccount, identifier: ChannelMessageIdentifier & {
        attachmentRemoteId: string;
    }): Promise<ChannelAttachmentContent>;
    sendMessage(account: ChannelAccount, payload: ChannelSendMessageInput): Promise<ChannelSendMessageResult>;
    setFlags?(account: ChannelAccount, identifier: ChannelMessageIdentifier, flags: ChannelSetFlagsInput): Promise<void>;
    moveMessage?(account: ChannelAccount, identifier: ChannelMessageIdentifier, targetMailbox: string): Promise<void>;
    markAsSpam?(account: ChannelAccount, identifier: ChannelMessageIdentifier): Promise<void>;
}
export type ChannelAdapterFactory = () => ChannelAdapter;
