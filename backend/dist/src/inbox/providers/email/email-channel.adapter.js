"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailChannelAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailChannelAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const channel_registry_1 = require("../../registry/channel-registry");
const email_channel_config_1 = require("./email-channel.config");
const imapflow_1 = require("imapflow");
const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");
const mailparser_1 = require("mailparser");
let EmailChannelAdapter = EmailChannelAdapter_1 = class EmailChannelAdapter {
    configService;
    registry;
    type = client_1.InboxChannelType.EMAIL;
    logger = new common_1.Logger(EmailChannelAdapter_1.name);
    config;
    cachedSentMailbox = null;
    constructor(configService, registry) {
        this.configService = configService;
        this.registry = registry;
        this.config = (0, email_channel_config_1.buildEmailChannelConfig)(this.configService, {
            logger: this.logger,
        });
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('Email channel adapter registered');
    }
    async listMailboxes(_account) {
        if (!this.isConfigured()) {
            this.logger.warn('Email channel is not fully configured. Returning fallback mailbox list.');
            return this.buildFallbackMailboxes();
        }
        return this.withImapClient(async (client) => {
            const listed = await client.list({
                statusQuery: {
                    unseen: true,
                    messages: true,
                },
            });
            const mailboxes = listed.map((mailbox) => this.mapMailbox(mailbox));
            if (!mailboxes.some((box) => box.id.toUpperCase() === 'INBOX')) {
                mailboxes.unshift({ id: 'INBOX', label: 'Inbox', type: 'inbox' });
            }
            return mailboxes;
        });
    }
    async listMessages(_account, _options) {
        if (!this.isConfigured()) {
            this.logger.warn('Email channel is not fully configured. Returning empty message list.');
            return { messages: [], nextCursor: null };
        }
        const mailbox = (_options.mailbox || 'INBOX').trim();
        const limit = Math.min(Math.max(_options.limit ?? 20, 1), 200);
        return this.withImapClient(async (client) => {
            let mailboxInfo;
            try {
                mailboxInfo = await client.mailboxOpen(mailbox, { readOnly: true });
            }
            catch (error) {
                this.logger.error(`Failed to open mailbox ${mailbox}: ${error.message}`);
                throw error;
            }
            try {
                if (!mailboxInfo || mailboxInfo.exists === 0) {
                    return { messages: [], nextCursor: null };
                }
                const start = Math.max(mailboxInfo.exists - limit + 1, 1);
                const sequence = `${start}:*`;
                const fetched = [];
                for await (const message of client.fetch(sequence, {
                    envelope: true,
                    flags: true,
                    internalDate: true,
                    uid: true,
                    bodyStructure: true,
                    size: true,
                    source: true,
                })) {
                    fetched.push(message);
                }
                const mapped = await Promise.all(fetched.map((message) => this.mapFetchMessage(mailbox, message)));
                const messages = mapped
                    .filter((message) => Boolean(message))
                    .sort((a, b) => {
                    const dateA = a.sentAt?.getTime() ?? a.receivedAt?.getTime() ?? 0;
                    const dateB = b.sentAt?.getTime() ?? b.receivedAt?.getTime() ?? 0;
                    return dateA - dateB;
                });
                return {
                    messages,
                    nextCursor: null,
                };
            }
            finally {
                await client.mailboxClose().catch(() => undefined);
            }
        });
    }
    async getMessage(_account, _identifier) {
        if (!this.isConfigured()) {
            this.logger.warn('Email channel is not fully configured. Returning empty message body.');
            return {
                remoteId: _identifier.remoteId,
                threadRemoteId: _identifier.threadRemoteId,
                subject: '',
                bodyHtml: '',
                bodyText: '',
                attachments: [],
                headers: {},
            };
        }
        this.logger.warn('Email channel getMessage requested but no provider integration is available. Returning empty message body.');
        return {
            remoteId: _identifier.remoteId,
            threadRemoteId: _identifier.threadRemoteId,
            subject: '',
            bodyHtml: '',
            bodyText: '',
            attachments: [],
            headers: {},
        };
    }
    async getAttachmentContent(_account, _identifier) {
        this.assertConfigured();
        throw new Error('Email channel getAttachmentContent not implemented yet');
    }
    async sendMessage(account, payload) {
        this.assertConfigured();
        const sender = this.resolveSender(payload.from);
        const to = this.normalizeAddressArray(payload.to);
        const cc = this.normalizeAddressArray(payload.cc);
        const bcc = this.normalizeAddressArray(payload.bcc);
        const replyTo = this.normalizeAddressArray(payload.replyTo);
        if (to.length + cc.length + bcc.length === 0) {
            throw new Error('At least one recipient address is required to send an email message.');
        }
        const mailOptions = this.buildMailComposerOptions({
            payload,
            sender,
            to,
            cc,
            bcc,
            replyTo,
        });
        const rawMessage = await this.buildRawMessage(mailOptions);
        const transporter = nodemailer.createTransport(this.buildSmtpOptions());
        try {
            const info = await transporter.sendMail({
                envelope: this.buildEnvelope(sender.address, [...to, ...cc, ...bcc]),
                raw: rawMessage,
            });
            let appendResult = null;
            try {
                appendResult = await this.appendToSentMailbox(rawMessage);
            }
            catch (error) {
                this.logger.error(`Message sent but failed to store copy in Sent mailbox: ${error.message}`);
                throw new Error(`El correo fue enviado pero no se pudo guardar una copia en la bandeja de enviados: ${error.message}`);
            }
            const remoteId = this.extractAppendUid(appendResult) ??
                this.extractMessageId(info) ??
                Date.now().toString();
            const accepted = this.normalizeRecipientResult(info.accepted);
            const rejected = this.normalizeRecipientResult(info.rejected);
            const metadata = this.buildSendMetadata(info, appendResult, account, {
                accepted,
                rejected,
            });
            this.logger.log(`Email message sent via SMTP (messageId=${metadata.messageId ?? 'n/a'}, remoteId=${remoteId}).`);
            return {
                remoteId,
                threadRemoteId: payload.replyToRemoteId ??
                    this.extractThreadRemoteId(appendResult),
                accepted,
                rejected,
                metadata,
            };
        }
        catch (error) {
            this.logger.error(`Failed to send email message: ${error.message}`);
            throw error;
        }
        finally {
            if (typeof transporter.close === 'function') {
                transporter.close();
            }
        }
    }
    async setFlags(_account, _identifier, _flags) {
        this.assertConfigured();
        throw new Error('Email channel setFlags not implemented yet');
    }
    async moveMessage(_account, _identifier, _targetMailbox) {
        this.assertConfigured();
        throw new Error('Email channel moveMessage not implemented yet');
    }
    async markAsSpam(_account, _identifier) {
        this.assertConfigured();
        throw new Error('Email channel markAsSpam not implemented yet');
    }
    refreshConfig() {
        this.config = (0, email_channel_config_1.buildEmailChannelConfig)(this.configService, {
            logger: this.logger,
        });
    }
    getSanitizedConfig() {
        return {
            ...this.config,
            credentials: { user: this.config.credentials.user },
        };
    }
    resolveSender(from) {
        const configuredAddress = (from?.address || this.config.defaults.fromAddress || '').trim();
        if (!configuredAddress) {
            throw new Error('No sender address configured. Provide fromAddress or set INBOX_EMAIL_DEFAULT_FROM.');
        }
        const configuredName = (from?.name || this.config.defaults.fromName || '').trim();
        return {
            address: configuredAddress,
            name: configuredName || undefined,
        };
    }
    normalizeAddressArray(addresses) {
        if (!Array.isArray(addresses)) {
            return [];
        }
        return addresses
            .map((entry) => (entry || '').trim())
            .filter((entry) => entry.length > 0);
    }
    buildMailComposerOptions(options) {
        const { payload, sender, to, cc, bcc, replyTo } = options;
        const htmlBody = payload.body.html?.trim();
        const textBody = payload.body.text?.trim() ||
            (htmlBody ? this.stripHtml(htmlBody).replace(/\s+/g, ' ').trim() : undefined);
        const attachments = payload.attachments?.map((attachment) => ({
            filename: attachment.fileName,
            content: attachment.content,
            contentType: attachment.contentType,
        })) ?? [];
        return {
            from: this.formatAddress(sender),
            to,
            cc: cc.length > 0 ? cc : undefined,
            bcc: bcc.length > 0 ? bcc : undefined,
            replyTo: replyTo.length > 0 ? replyTo.join(', ') : undefined,
            subject: payload.subject,
            text: textBody,
            html: htmlBody || undefined,
            attachments: attachments.length > 0 ? attachments : undefined,
        };
    }
    async buildRawMessage(options) {
        const composer = new MailComposer(options);
        const mimeNode = composer.compile();
        return mimeNode.build();
    }
    buildEnvelope(from, recipients) {
        const unique = Array.from(new Set(recipients
            .map((address) => address.trim())
            .filter((address) => address.length > 0)));
        return {
            from,
            to: unique,
        };
    }
    async appendToSentMailbox(rawMessage) {
        return this.withImapClient(async (client) => {
            const candidates = await this.resolveSentMailboxCandidates(client);
            let lastError = null;
            for (const mailbox of candidates) {
                try {
                    const response = await client.append(mailbox, rawMessage, ['\\Seen'], new Date());
                    if (!response) {
                        continue;
                    }
                    this.cachedSentMailbox = response.destination || mailbox;
                    return {
                        mailbox: response.destination || mailbox,
                        response,
                    };
                }
                catch (error) {
                    lastError = error;
                    this.logger.warn(`Failed to append message to mailbox ${mailbox}: ${lastError.message}`);
                }
            }
            if (lastError) {
                throw lastError;
            }
            return null;
        });
    }
    async resolveSentMailboxCandidates(client) {
        const candidates = new Set();
        if (this.cachedSentMailbox) {
            candidates.add(this.cachedSentMailbox);
        }
        try {
            const listed = await client.list();
            for (const mailbox of listed) {
                const type = this.resolveMailboxType(mailbox);
                if (type === 'sent') {
                    candidates.add(mailbox.path);
                    if (!this.cachedSentMailbox) {
                        this.cachedSentMailbox = mailbox.path;
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to list mailboxes while resolving Sent folder: ${error.message}`);
        }
        ;
        ['Sent', 'Sent Items', 'INBOX.Sent', 'INBOX/Sent', '[Gmail]/Sent Mail'].forEach((path) => candidates.add(path));
        return Array.from(candidates);
    }
    extractAppendUid(result) {
        if (!result) {
            return null;
        }
        if (result.response.uid !== undefined) {
            return result.response.uid.toString();
        }
        if (result.response.seq !== undefined) {
            return result.response.seq.toString();
        }
        return null;
    }
    extractThreadRemoteId(result) {
        const uid = this.extractAppendUid(result);
        return uid ?? undefined;
    }
    extractMessageId(info) {
        const rawId = info.messageId;
        if (!rawId) {
            return null;
        }
        return rawId.replace(/[<>]/g, '').trim() || null;
    }
    normalizeRecipientResult(recipients) {
        if (!Array.isArray(recipients)) {
            return [];
        }
        return recipients
            .map((entry) => {
            if (!entry) {
                return null;
            }
            if (typeof entry === 'string') {
                return entry.trim();
            }
            if (typeof entry === 'object' && 'address' in entry && entry.address) {
                return entry.address.trim();
            }
            return null;
        })
            .filter((value) => Boolean(value && value.length > 0));
    }
    buildSendMetadata(info, appendResult, account, delivery) {
        const metadata = {
            messageId: this.extractMessageId(info),
            envelope: info.envelope,
            response: info.response,
            accepted: delivery.accepted,
            rejected: delivery.rejected,
            accountId: account.id,
        };
        if (appendResult) {
            metadata.sentMailbox = appendResult.mailbox;
            metadata.appendUid = appendResult.response.uid ?? null;
            metadata.appendSeq = appendResult.response.seq ?? null;
            metadata.appendUidValidity = appendResult.response.uidValidity
                ? appendResult.response.uidValidity.toString()
                : null;
        }
        return metadata;
    }
    formatAddress(address) {
        if (address.name) {
            return `${address.name} <${address.address}>`;
        }
        return address.address;
    }
    buildSmtpOptions() {
        const security = (this.config.smtp.security || 'STARTTLS').toUpperCase();
        const options = {
            host: this.config.smtp.host,
            port: this.config.smtp.port,
            auth: {
                user: this.config.credentials.user,
                pass: this.config.credentials.password,
            },
        };
        if (security === 'SSL_TLS') {
            options.secure = true;
            options.tls = {
                rejectUnauthorized: true,
            };
        }
        else if (security === 'STARTTLS') {
            options.secure = false;
            options.requireTLS = true;
            options.tls = {
                rejectUnauthorized: true,
            };
        }
        else {
            options.secure = false;
            options.requireTLS = false;
            options.tls = {
                rejectUnauthorized: false,
            };
        }
        return options;
    }
    assertConfigured() {
        if (!this.config.credentials.user || !this.config.credentials.password) {
            throw new Error('Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.');
        }
        if (!this.config.imap.host || !this.config.smtp.host) {
            throw new Error('Email channel adapter hosts are not configured. Review INBOX_EMAIL_* environment variables.');
        }
    }
    isConfigured() {
        return Boolean(this.config?.credentials.user &&
            this.config?.credentials.password &&
            this.config?.imap.host);
    }
    buildFallbackMailboxes() {
        return [
            { id: 'INBOX', label: 'Inbox', type: 'inbox' },
            { id: 'SENT', label: 'Sent', type: 'sent' },
            { id: 'DRAFTS', label: 'Drafts', type: 'drafts' },
            { id: 'TRASH', label: 'Trash', type: 'trash' },
        ];
    }
    async withImapClient(fn) {
        const options = this.buildImapOptions();
        const client = new imapflow_1.ImapFlow(options);
        try {
            await client.connect();
            return await fn(client);
        }
        finally {
            try {
                await client.logout();
            }
            catch (error) {
                this.logger.warn(`Error closing IMAP connection: ${error.message}`);
            }
            finally {
                client.close();
            }
        }
    }
    buildImapOptions() {
        const security = (this.config.imap.security || 'SSL_TLS').toUpperCase();
        const useTls = security !== 'NONE';
        const secure = security === 'SSL_TLS';
        return {
            host: this.config.imap.host,
            port: this.config.imap.port,
            secure,
            auth: {
                user: this.config.credentials.user,
                pass: this.config.credentials.password,
            },
            tls: {
                rejectUnauthorized: useTls,
            },
            disableTLS: !useTls,
            logger: false,
        };
    }
    mapMailbox(mailbox) {
        const mailBoxType = this.resolveMailboxType(mailbox);
        const label = this.resolveMailboxLabel(mailbox);
        return {
            id: mailbox.path,
            label,
            type: mailBoxType,
            metadata: {
                delimiter: mailbox.delimiter,
                path: mailbox.path,
                flags: mailbox.flags,
                specialUse: mailbox.specialUse,
                status: mailbox.status,
            },
        };
    }
    resolveMailboxLabel(mailbox) {
        if ('name' in mailbox && mailbox.name) {
            return mailbox.name;
        }
        const segments = mailbox.path.split(mailbox.delimiter);
        const last = segments[segments.length - 1];
        return last || mailbox.path;
    }
    resolveMailboxType(mailbox) {
        const specialUse = (mailbox.specialUse || '').toUpperCase();
        switch (specialUse) {
            case '\\INBOX':
            case 'INBOX':
                return 'inbox';
            case '\\SENT':
            case 'SENT':
                return 'sent';
            case '\\DRAFTS':
            case 'DRAFTS':
                return 'drafts';
            case '\\TRASH':
            case 'TRASH':
                return 'trash';
            case '\\JUNK':
            case 'JUNK':
                return 'spam';
            case '\\ARCHIVE':
                return 'archive';
            default:
                break;
        }
        const label = this.resolveMailboxLabel(mailbox);
        const upper = label.toUpperCase();
        if (upper.includes('INBOX'))
            return 'inbox';
        if (upper.includes('SENT'))
            return 'sent';
        if (upper.includes('DRAFT'))
            return 'drafts';
        if (upper.includes('TRASH') || upper.includes('BIN'))
            return 'trash';
        if (upper.includes('SPAM') || upper.includes('JUNK'))
            return 'spam';
        if (upper.includes('ARCHIVE'))
            return 'archive';
        return 'custom';
    }
    async mapFetchMessage(mailbox, message) {
        if (!message.uid) {
            return null;
        }
        const envelope = message.envelope || {};
        const subject = (envelope.subject || '').toString();
        const internalDate = message.internalDate ? new Date(message.internalDate) : undefined;
        const sentDate = envelope.date ? new Date(envelope.date) : internalDate;
        const direction = this.resolveDirection(mailbox);
        const flags = this.normalizeFlags(message.flags);
        const parsed = await this.safeParseMessage(message.source);
        const from = this.extractSingleAddress(envelope.from) ||
            this.extractSingleParsedAddress(parsed?.from?.value);
        const to = this.mergeAddresses(this.extractAddressList(envelope.to), this.extractParsedAddressList(parsed?.to?.value));
        const cc = this.mergeAddresses(this.extractAddressList(envelope.cc), this.extractParsedAddressList(parsed?.cc?.value));
        const bcc = this.mergeAddresses(this.extractAddressList(envelope.bcc), this.extractParsedAddressList(parsed?.bcc?.value));
        const snippet = this.buildSnippet(parsed);
        const previewText = snippet;
        const parsedAttachments = this.mapParsedAttachments(parsed);
        const hasAttachments = this.detectAttachments(message) ||
            parsedAttachments.length > 0;
        return {
            remoteId: message.uid.toString(),
            threadRemoteId: message.threadId ? message.threadId.toString() : undefined,
            subject,
            snippet,
            previewText,
            from,
            to,
            cc,
            bcc,
            direction,
            folder: mailbox,
            isRead: flags.has('\\SEEN'),
            isStarred: flags.has('\\FLAGGED'),
            isSpam: flags.has('\\JUNK') || flags.has('\\SPAM'),
            hasAttachments,
            sentAt: sentDate ?? null,
            receivedAt: internalDate ?? sentDate ?? null,
            metadata: {
                mailbox,
                size: message.size,
                messageId: envelope.messageId,
                inReplyTo: envelope.inReplyTo,
                previewText: previewText ?? null,
                snippet: snippet ?? null,
                bodyHtml: parsed?.html ?? null,
                bodyText: parsed?.text ?? null,
                headers: this.extractHeaders(parsed),
                attachments: parsedAttachments,
            },
        };
    }
    extractSingleAddress(input) {
        const address = Array.isArray(input) && input.length > 0 ? input[0] : undefined;
        if (!address) {
            return undefined;
        }
        const email = (address.address || '').trim();
        if (!email) {
            return undefined;
        }
        return {
            name: address.name || undefined,
            address: email || undefined,
        };
    }
    extractAddressList(input) {
        if (!Array.isArray(input)) {
            return [];
        }
        const addresses = [];
        for (const entry of input) {
            if (!entry) {
                continue;
            }
            const email = (entry.address || '').trim();
            if (!email) {
                continue;
            }
            const record = {
                address: email,
            };
            if (entry.name) {
                record.name = entry.name;
            }
            addresses.push(record);
        }
        return addresses;
    }
    resolveDirection(mailbox) {
        const normalized = mailbox.toLowerCase();
        if (normalized.includes('sent')) {
            return client_1.InboxMessageDirection.OUTBOUND;
        }
        return client_1.InboxMessageDirection.INBOUND;
    }
    detectAttachments(message) {
        const structure = message.bodyStructure;
        if (!structure) {
            return false;
        }
        const stack = [structure];
        while (stack.length) {
            const node = stack.pop();
            if (!node)
                continue;
            if (Array.isArray(node.childNodes)) {
                stack.push(...node.childNodes);
            }
            const disposition = ((node.disposition && node.disposition.type) || '').toUpperCase();
            if (disposition === 'ATTACHMENT') {
                return true;
            }
        }
        return false;
    }
    normalizeFlags(flags) {
        const collection = new Set();
        if (!flags) {
            return collection;
        }
        const values = Array.isArray(flags) ? flags : Array.from(flags);
        for (const flag of values) {
            if (!flag)
                continue;
            collection.add(flag.toUpperCase());
        }
        return collection;
    }
    mapParsedAttachments(parsed) {
        if (!parsed?.attachments || parsed.attachments.length === 0) {
            return [];
        }
        return parsed.attachments.map((attachment) => ({
            file: attachment.filename || 'attachment',
            size: attachment.size ?? null,
            contentType: attachment.contentType ?? null,
            inline: attachment.related ?? false,
            contentId: attachment.cid ?? null,
        }));
    }
    mergeAddresses(primary, secondary) {
        if (secondary.length === 0) {
            return primary;
        }
        const seen = new Map();
        for (const item of primary) {
            seen.set(item.address.toLowerCase(), item);
        }
        for (const item of secondary) {
            const key = item.address.toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, item);
            }
        }
        return Array.from(seen.values());
    }
    extractParsedAddressList(input) {
        if (!Array.isArray(input)) {
            return [];
        }
        return input
            .map((entry) => {
            const email = (entry.address || '').trim();
            if (!email) {
                return null;
            }
            const record = {
                address: email,
            };
            if (entry.name) {
                record.name = entry.name;
            }
            return record;
        })
            .filter((address) => Boolean(address));
    }
    extractSingleParsedAddress(input) {
        if (!Array.isArray(input) || input.length === 0) {
            return undefined;
        }
        const first = this.extractParsedAddressList(input)[0];
        return first;
    }
    async safeParseMessage(source) {
        if (!source || source.length === 0) {
            return undefined;
        }
        try {
            return await (0, mailparser_1.simpleParser)(source);
        }
        catch (error) {
            this.logger.warn(`Failed to parse message source: ${error.message}`);
            return undefined;
        }
    }
    buildSnippet(parsed) {
        if (!parsed) {
            return null;
        }
        const textContent = parsed.text || (parsed.html ? this.stripHtml(parsed.html) : '');
        if (!textContent) {
            return null;
        }
        const normalized = textContent
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized) {
            return null;
        }
        return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
    }
    stripHtml(html) {
        return html
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>');
    }
    extractHeaders(parsed) {
        if (!parsed) {
            return undefined;
        }
        const headers = {};
        if (Array.isArray(parsed.headerLines)) {
            for (const header of parsed.headerLines) {
                if (!header || !header.key)
                    continue;
                const key = header.key.toLowerCase();
                if (headers[key]) {
                    headers[key] = `${headers[key]}, ${header.line?.split(':').slice(1).join(':').trim() ?? ''}`.trim();
                }
                else {
                    headers[key] = header.line ?? '';
                }
            }
        }
        else if (parsed.headers instanceof Map) {
            for (const [key, value] of parsed.headers) {
                if (!key)
                    continue;
                headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
            }
        }
        return Object.keys(headers).length > 0 ? headers : undefined;
    }
};
exports.EmailChannelAdapter = EmailChannelAdapter;
exports.EmailChannelAdapter = EmailChannelAdapter = EmailChannelAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        channel_registry_1.ChannelRegistry])
], EmailChannelAdapter);
//# sourceMappingURL=email-channel.adapter.js.map