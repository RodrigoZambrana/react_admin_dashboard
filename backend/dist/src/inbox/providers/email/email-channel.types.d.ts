export type EmailChannelSecurityOption = 'SSL_TLS' | 'STARTTLS' | 'NONE';
export type EmailConnectionConfig = {
    host: string;
    port: number;
    security: EmailChannelSecurityOption;
};
export type EmailChannelConfig = {
    imap: EmailConnectionConfig;
    smtp: EmailConnectionConfig;
    credentials: {
        user: string;
        password: string;
    };
    defaults: {
        fromAddress: string;
        fromName?: string;
    };
    limits: {
        maxAttachmentSizeMb: number;
        outgoingRatePerMinute: number;
    };
    polling: {
        intervalMs: number;
        batchSize: number;
    };
};
