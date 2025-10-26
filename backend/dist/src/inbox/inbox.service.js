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
var InboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const channel_registry_1 = require("./registry/channel-registry");
const message_identity_1 = require("./common/message-identity");
const queue_classifier_1 = require("./common/queue-classifier");
const inbox_events_service_1 = require("./events/inbox-events.service");
const email_channel_adapter_1 = require("./providers/email/email-channel.adapter");
const toJsonInput = (value) => value === undefined || value === null
    ? client_1.Prisma.JsonNull
    : value;
const toJsonUpdate = (value) => value === undefined ? undefined : toJsonInput(value);
let InboxService = InboxService_1 = class InboxService {
    prisma;
    configService;
    registry;
    emailAdapter;
    events;
    logger = new common_1.Logger(InboxService_1.name);
    queueRuleConfig;
    queueCache = new Map();
    constructor(prisma, configService, registry, emailAdapter, events) {
        this.prisma = prisma;
        this.configService = configService;
        this.registry = registry;
        this.emailAdapter = emailAdapter;
        this.events = events;
        this.queueRuleConfig = this.buildQueueConfig();
    }
    async onModuleInit() {
        await this.ensureConfiguredEmailAccount();
    }
    streamMessageEvents(filters = {}) {
        return this.events.streamEvents(filters);
    }
    async listAccounts(options = {}) {
        const where = options.includeInactive
            ? undefined
            : { active: true };
        return this.prisma.inboxAccount.findMany({
            where,
            orderBy: { createdAt: 'asc' },
        });
    }
    async listMailboxes(accountId) {
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        return adapter.listMailboxes(channelAccount);
    }
    async listMessages(accountId, options) {
        this.assertMailboxOption(options);
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        const response = await adapter.listMessages(channelAccount, options);
        const persisted = await this.persistMessageList(account, options.mailbox, response.messages, response.nextCursor ?? null);
        const summaries = persisted.map((record) => {
            const summary = this.serializeMessage(record);
            const isNew = record.createdAt.getTime() === record.updatedAt.getTime();
            if (isNew) {
                this.emitBroadcast('message.created', summary);
            }
            return summary;
        });
        return {
            items: summaries,
            nextCursor: response.nextCursor ?? null,
        };
    }
    async getMessage(accountId, identifier) {
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        const body = await adapter.getMessage(channelAccount, identifier);
        const provider = this.resolveProvider(account);
        const metadata = this.extractBodyMetadata(body);
        const detail = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.inboxMessage.findUnique({
                where: {
                    accountId_channel_remoteId: {
                        accountId: account.id,
                        channel: account.channel,
                        remoteId: identifier.remoteId,
                    },
                },
                include: { queue: true },
            });
            const folder = existing?.folder ?? this.resolveFolder(this.extractMetadataString(metadata, 'folder') ??
                this.extractMetadataString(metadata, 'mailbox') ??
                undefined);
            const queueResolution = existing?.queue
                ? { slug: existing.queue.slug, matchedRule: 'persisted' }
                : (0, queue_classifier_1.resolveQueueSlug)({
                    headers: this.extractHeaderMap(metadata),
                    subject: body.subject,
                    folder,
                }, this.queueRuleConfig);
            const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution));
            const messageUid = (0, message_identity_1.deriveMessageUid)({
                provider,
                folder,
                messageId: this.extractMetadataString(metadata, 'messageId'),
                gmailId: this.extractMetadataString(metadata, 'gmailId'),
                remoteId: body.remoteId,
                headers: this.extractHeaderMap(metadata),
                bodyHtml: body.bodyHtml,
                bodyText: body.bodyText,
            });
            const bodyHash = (0, message_identity_1.hashMessageBody)({
                bodyHtml: body.bodyHtml ?? null,
                bodyText: body.bodyText ?? null,
            });
            const messageRecord = await tx.inboxMessage.upsert({
                where: {
                    messageUid_provider_folder: {
                        messageUid,
                        provider,
                        folder,
                    },
                },
                update: this.buildMessageUpdateFromBody(body, folder, provider, queueId, bodyHash, metadata, queueResolution),
                create: this.buildMessageCreateFromBody(account, body, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution),
                include: { queue: true },
            });
            await tx.inboxAttachment.deleteMany({
                where: { messageId: messageRecord.id },
            });
            const attachmentRecords = [];
            for (const attachment of body.attachments || []) {
                const created = await tx.inboxAttachment.create({
                    data: {
                        messageId: messageRecord.id,
                        remoteId: attachment.remoteId ?? null,
                        fileName: attachment.fileName ?? null,
                        contentType: attachment.contentType ?? null,
                        size: attachment.size ?? null,
                        metadata: toJsonInput(this.buildAttachmentMetadata(attachment)),
                    },
                });
                attachmentRecords.push(created);
            }
            await this.recordEvent(tx, messageRecord.id, client_1.InboxMessageEventType.FETCHED, {
                attachmentCount: attachmentRecords.length,
                queue: queueResolution.slug,
            });
            return this.serializeMessageDetail(messageRecord, body, attachmentRecords);
        });
        return detail;
    }
    async sendMessage(accountId, payload) {
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        const attachments = (payload.attachments || []).map((attachment) => this.decodeAttachmentInput(attachment));
        const normalizedFromAddress = (payload.fromAddress ?? '').trim();
        const normalizedFromName = (payload.fromName ?? '').trim();
        const messageInput = {
            subject: payload.subject,
            from: normalizedFromAddress || normalizedFromName
                ? {
                    address: normalizedFromAddress,
                    name: normalizedFromName || undefined,
                }
                : undefined,
            body: {
                html: payload.bodyHtml ?? undefined,
                text: payload.bodyText ?? undefined,
            },
            to: payload.to,
            cc: payload.cc ?? [],
            bcc: payload.bcc ?? [],
            replyTo: payload.replyTo ?? [],
            replyToRemoteId: payload.replyToRemoteId,
            attachments,
            metadata: payload.metadata ?? undefined,
        };
        const result = await adapter.sendMessage(channelAccount, messageInput);
        const provider = this.resolveProvider(account);
        const folder = this.resolveFolder('Sent');
        const baseMetadata = this.mergeMetadata(payload.metadata ?? undefined, result.metadata ?? undefined) ?? {};
        const explicitQueueSlug = payload.queueSlug ??
            (typeof baseMetadata.queue === 'string' ? String(baseMetadata.queue) : undefined);
        const queueResolution = explicitQueueSlug
            ? {
                slug: explicitQueueSlug.toLowerCase(),
                matchedRule: payload.queueSlug ? 'payload.slug' : 'metadata.queue',
            }
            : (0, queue_classifier_1.resolveQueueSlug)({
                headers: this.extractHeaderMap(baseMetadata),
                to: payload.to.map((address) => ({ address })),
                cc: (payload.cc ?? []).map((address) => ({ address })),
                bcc: (payload.bcc ?? []).map((address) => ({ address })),
                subject: payload.subject,
                folder,
            }, this.queueRuleConfig);
        const bodyHash = (0, message_identity_1.hashMessageBody)({
            bodyHtml: payload.bodyHtml ?? null,
            bodyText: payload.bodyText ?? null,
        });
        const messageUid = (0, message_identity_1.deriveMessageUid)({
            provider,
            folder,
            messageId: this.extractMetadataString(baseMetadata, 'messageId'),
            gmailId: this.extractMetadataString(baseMetadata, 'gmailId'),
            remoteId: result.remoteId,
            headers: this.extractHeaderMap(baseMetadata),
            bodyHtml: payload.bodyHtml,
            bodyText: payload.bodyText,
        });
        const summary = await this.prisma.$transaction(async (tx) => {
            let effectiveQueueResolution = queueResolution;
            let queueId;
            if (payload.queueId) {
                const existingQueue = await tx.inboxQueue.findUnique({
                    where: { id: payload.queueId },
                });
                if (existingQueue) {
                    queueId = existingQueue.id;
                    effectiveQueueResolution = {
                        slug: existingQueue.slug,
                        matchedRule: 'payload.id',
                    };
                }
                else {
                    queueId = await this.ensureQueue(tx, queueResolution);
                }
            }
            else {
                queueId = await this.ensureQueue(tx, queueResolution);
            }
            const messageRecord = await tx.inboxMessage.upsert({
                where: {
                    messageUid_provider_folder: {
                        messageUid,
                        provider,
                        folder,
                    },
                },
                update: this.buildMessageUpdateFromSend(payload, result, folder, provider, queueId, bodyHash, baseMetadata, effectiveQueueResolution),
                create: this.buildMessageCreateFromSend(account, payload, result, folder, provider, messageUid, queueId, bodyHash, baseMetadata, effectiveQueueResolution),
                include: { queue: true },
            });
            await this.recordEvent(tx, messageRecord.id, client_1.InboxMessageEventType.SENT, {
                accepted: result.accepted,
                rejected: result.rejected,
                queue: effectiveQueueResolution.slug,
            });
            return this.serializeMessage(messageRecord);
        });
        this.emitBroadcast('message.sent', summary);
        return summary;
    }
    async setFlags(accountId, identifier, flags) {
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        if (adapter.setFlags) {
            await adapter.setFlags(channelAccount, identifier, flags);
        }
        else {
            this.logger.warn(`Channel adapter ${account.channel} does not implement setFlags. Persisting flags locally only.`);
        }
        const summary = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.inboxMessage.findUnique({
                where: {
                    accountId_channel_remoteId: {
                        accountId: account.id,
                        channel: account.channel,
                        remoteId: identifier.remoteId,
                    },
                },
                include: { queue: true },
            });
            const provider = this.resolveProvider(account);
            const folder = existing?.folder ?? this.resolveFolder(undefined);
            const queueResolution = existing?.queue
                ? { slug: existing.queue.slug, matchedRule: 'persisted' }
                : { slug: this.queueRuleConfig.defaultQueue, matchedRule: 'default' };
            const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution));
            const messageUid = existing?.messageUid ??
                (0, message_identity_1.deriveMessageUid)({
                    provider,
                    folder,
                    remoteId: identifier.remoteId,
                });
            const metadataSource = existing?.metadata ?? undefined;
            const messageRecord = await tx.inboxMessage.upsert({
                where: {
                    messageUid_provider_folder: {
                        messageUid,
                        provider,
                        folder,
                    },
                },
                update: {
                    ...this.buildFlagUpdate(flags, metadataSource, queueResolution),
                    queue: { connect: { id: queueId } },
                },
                create: this.buildMinimalMessage(account, identifier, flags, folder, provider, messageUid, queueId, queueResolution),
                include: { queue: true },
            });
            await this.recordEvent(tx, messageRecord.id, client_1.InboxMessageEventType.FLAG_UPDATED, {
                flags,
                queue: queueResolution.slug,
            });
            return this.serializeMessage(messageRecord);
        });
        this.emitBroadcast('message.flags.updated', summary);
        return summary;
    }
    async moveMessage(accountId, identifier, targetMailbox) {
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        if (adapter.moveMessage) {
            await adapter.moveMessage(channelAccount, identifier, targetMailbox);
        }
        else {
            this.logger.warn(`Channel adapter ${account.channel} does not implement moveMessage. Persisting move locally only.`);
        }
        const summary = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.inboxMessage.findUnique({
                where: {
                    accountId_channel_remoteId: {
                        accountId: account.id,
                        channel: account.channel,
                        remoteId: identifier.remoteId,
                    },
                },
                include: { queue: true },
            });
            const provider = this.resolveProvider(account);
            const folder = this.resolveFolder(targetMailbox);
            const queueResolution = existing?.queue
                ? { slug: existing.queue.slug, matchedRule: 'persisted' }
                : { slug: this.queueRuleConfig.defaultQueue, matchedRule: 'default' };
            const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution));
            const messageUid = existing?.messageUid ??
                (0, message_identity_1.deriveMessageUid)({
                    provider,
                    folder,
                    remoteId: identifier.remoteId,
                });
            const isSpamTarget = folder.toLowerCase().includes('spam') || folder.toLowerCase().includes('junk');
            const metadataSource = existing?.metadata ?? undefined;
            const updatedMetadata = this.mergeMetadata(metadataSource, {
                queue: queueResolution.slug,
                queueRule: queueResolution.matchedRule,
            });
            const messageRecord = await tx.inboxMessage.upsert({
                where: {
                    messageUid_provider_folder: {
                        messageUid,
                        provider,
                        folder,
                    },
                },
                update: {
                    provider,
                    folder,
                    isSpam: isSpamTarget,
                    queue: { connect: { id: queueId } },
                    metadata: updatedMetadata ? toJsonUpdate(updatedMetadata) : undefined,
                },
                create: this.buildMinimalMessage(account, identifier, { spam: isSpamTarget }, folder, provider, messageUid, queueId, queueResolution),
                include: { queue: true },
            });
            await this.recordEvent(tx, messageRecord.id, client_1.InboxMessageEventType.MOVED, {
                targetMailbox,
                queue: queueResolution.slug,
            });
            return this.serializeMessage(messageRecord);
        });
        this.emitBroadcast('message.moved', summary);
        return summary;
    }
    async markAsSpam(accountId, identifier) {
        const account = await this.getAccountOrThrow(accountId);
        const adapter = this.resolveAdapter(account);
        const channelAccount = this.mapAccount(account);
        let movedFolder;
        if (adapter.markAsSpam) {
            await adapter.markAsSpam(channelAccount, identifier);
            movedFolder = 'Spam';
        }
        else if (adapter.moveMessage) {
            await adapter.moveMessage(channelAccount, identifier, 'Junk');
            movedFolder = 'Junk';
        }
        else {
            this.logger.warn(`Channel adapter ${account.channel} does not implement spam handling. Persisting spam flag locally only.`);
        }
        const targetFolder = movedFolder ?? 'Spam';
        const summary = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.inboxMessage.findUnique({
                where: {
                    accountId_channel_remoteId: {
                        accountId: account.id,
                        channel: account.channel,
                        remoteId: identifier.remoteId,
                    },
                },
                include: { queue: true },
            });
            const provider = this.resolveProvider(account);
            const folder = this.resolveFolder(targetFolder);
            const queueResolution = existing?.queue
                ? { slug: existing.queue.slug, matchedRule: 'persisted' }
                : { slug: this.queueRuleConfig.defaultQueue, matchedRule: 'default' };
            const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution));
            const messageUid = existing?.messageUid ??
                (0, message_identity_1.deriveMessageUid)({
                    provider,
                    folder,
                    remoteId: identifier.remoteId,
                });
            const metadataSource = existing?.metadata ?? undefined;
            const updatedMetadata = this.mergeMetadata(metadataSource, {
                queue: queueResolution.slug,
                queueRule: queueResolution.matchedRule,
            });
            const messageRecord = await tx.inboxMessage.upsert({
                where: {
                    messageUid_provider_folder: {
                        messageUid,
                        provider,
                        folder,
                    },
                },
                update: {
                    provider,
                    folder,
                    isSpam: true,
                    queue: { connect: { id: queueId } },
                    metadata: updatedMetadata ? toJsonUpdate(updatedMetadata) : undefined,
                },
                create: this.buildMinimalMessage(account, identifier, { spam: true }, folder, provider, messageUid, queueId, queueResolution),
                include: { queue: true },
            });
            await this.recordEvent(tx, messageRecord.id, client_1.InboxMessageEventType.FLAG_UPDATED, {
                spam: true,
                queue: queueResolution.slug,
            });
            return this.serializeMessage(messageRecord);
        });
        this.emitBroadcast('message.flags.updated', summary);
        return summary;
    }
    async synchronizeAccount(accountId, options = {}) {
        const mailboxes = options.mailboxes && options.mailboxes.length > 0 ? options.mailboxes : ['INBOX'];
        const results = [];
        for (const mailbox of mailboxes) {
            const { items, nextCursor } = await this.listMessages(accountId, {
                mailbox,
                limit: options.limit,
                cursor: options.cursor ?? undefined,
                since: options.since,
            });
            results.push({
                mailbox,
                fetched: items.length,
                nextCursor: nextCursor ?? null,
            });
        }
        return {
            accountId,
            mailboxes: results,
        };
    }
    assertMailboxOption(options) {
        if (!options.mailbox || !options.mailbox.trim()) {
            throw new common_1.BadRequestException('Mailbox is required to list messages.');
        }
    }
    resolveAdapter(account) {
        return this.registry.getAdapter(account.channel);
    }
    mapAccount(account) {
        return {
            id: account.id,
            address: account.address,
            displayName: account.displayName,
            metadata: account.metadata,
        };
    }
    async getAccountOrThrow(accountId) {
        const account = await this.prisma.inboxAccount.findUnique({
            where: { id: accountId },
        });
        if (!account) {
            throw new common_1.NotFoundException(`Inbox account ${accountId} was not found.`);
        }
        return account;
    }
    async persistMessageList(account, mailbox, messages, nextCursor) {
        if (messages.length === 0) {
            await this.prisma.inboxSyncState.upsert({
                where: {
                    accountId_channel_folder: {
                        accountId: account.id,
                        channel: account.channel,
                        folder: mailbox,
                    },
                },
                update: {
                    lastSyncAt: new Date(),
                    metadata: toJsonInput(nextCursor ? { nextCursor } : null),
                },
                create: {
                    accountId: account.id,
                    channel: account.channel,
                    folder: mailbox,
                    lastRemoteId: null,
                    lastSyncAt: new Date(),
                    metadata: toJsonInput(nextCursor ? { nextCursor } : null),
                },
            });
            return [];
        }
        return this.prisma.$transaction(async (tx) => {
            const persisted = [];
            const provider = this.resolveProvider(account);
            for (const message of messages) {
                const folder = this.resolveFolder(message.folder ?? mailbox);
                const metadata = this.extractListMetadata(message);
                const messageUid = (0, message_identity_1.deriveMessageUid)({
                    provider,
                    folder,
                    messageId: this.extractMetadataString(metadata, 'messageId'),
                    gmailId: this.extractMetadataString(metadata, 'gmailId'),
                    remoteId: message.remoteId,
                    headers: this.extractHeaderMap(metadata),
                    bodyHtml: this.extractMetadataString(metadata, 'bodyHtml'),
                    bodyText: this.extractMetadataString(metadata, 'bodyText'),
                });
                const bodyHash = (0, message_identity_1.hashMessageBody)({
                    bodyHtml: this.extractMetadataString(metadata, 'bodyHtml'),
                    bodyText: this.extractMetadataString(metadata, 'bodyText'),
                });
                const queueResolution = (0, queue_classifier_1.resolveQueueSlug)({
                    headers: this.extractHeaderMap(metadata),
                    to: message.to,
                    cc: message.cc,
                    bcc: message.bcc,
                    labels: this.extractLabels(metadata),
                    subject: message.subject,
                    folder,
                    direction: message.direction,
                }, this.queueRuleConfig);
                const queueId = await this.ensureQueue(tx, queueResolution);
                const existingByRemote = await tx.inboxMessage.findUnique({
                    where: {
                        accountId_channel_remoteId: {
                            accountId: account.id,
                            channel: account.channel,
                            remoteId: message.remoteId,
                        },
                    },
                });
                let record;
                if (existingByRemote) {
                    record = await tx.inboxMessage.update({
                        where: { id: existingByRemote.id },
                        data: this.buildMessageUpdateFromListItem(message, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution),
                        include: { queue: true },
                    });
                }
                else {
                    record = await tx.inboxMessage.upsert({
                        where: {
                            messageUid_provider_folder: {
                                messageUid,
                                provider,
                                folder,
                            },
                        },
                        update: this.buildMessageUpdateFromListItem(message, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution),
                        create: this.buildMessageCreateFromListItem(account, message, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution),
                        include: { queue: true },
                    });
                }
                persisted.push(record);
            }
            const lastRemoteId = messages[messages.length - 1]?.remoteId ?? null;
            await tx.inboxSyncState.upsert({
                where: {
                    accountId_channel_folder: {
                        accountId: account.id,
                        channel: account.channel,
                        folder: mailbox,
                    },
                },
                update: {
                    lastRemoteId,
                    lastSyncAt: new Date(),
                    metadata: toJsonInput(nextCursor ? { nextCursor } : null),
                },
                create: {
                    accountId: account.id,
                    channel: account.channel,
                    folder: mailbox,
                    lastRemoteId,
                    lastSyncAt: new Date(),
                    metadata: toJsonInput(nextCursor ? { nextCursor } : null),
                },
            });
            return persisted;
        });
    }
    buildQueueConfig() {
        return {
            headerKey: this.configService.get('INBOX_QUEUE_HEADER_KEY') ?? 'x-queue',
            defaultQueue: this.configService.get('INBOX_QUEUE_DEFAULT') ?? 'general',
            domainQueues: this.parseKeyValueConfig('INBOX_QUEUE_DOMAIN_MAP', {
                'support.acme.com': 'support',
                'ventas.acme.com': 'sales',
                'noc.acme.com': 'noc',
            }),
            aliasQueues: this.parseKeyValueConfig('INBOX_QUEUE_ALIAS_MAP', {
                'soporte@acme.com': 'support',
                'noc@acme.com': 'noc',
                'ventas@acme.com': 'sales',
            }),
            labelQueues: this.parseKeyValueConfig('INBOX_QUEUE_LABEL_MAP', {
                urgent: 'noc',
            }),
            subjectRules: this.parseSubjectRuleConfig('INBOX_QUEUE_SUBJECT_RULES', [
                { queue: 'billing', regex: /factura|billing|invoice/i },
                { queue: 'support', regex: /ticket|issue|soporte/i },
                { queue: 'noc', regex: /incident|alert|alarma/i },
            ]),
        };
    }
    parseKeyValueConfig(key, fallback = {}) {
        const raw = this.configService.get(key);
        if (!raw) {
            return fallback;
        }
        const parsedJson = this.parseJson(raw);
        if (parsedJson && typeof parsedJson === 'object') {
            return Object.entries(parsedJson).reduce((acc, [envKey, value]) => {
                if (typeof value === 'string' && value.trim()) {
                    acc[envKey.trim().toLowerCase()] = value.trim().toLowerCase();
                }
                return acc;
            }, {});
        }
        return raw
            .split(',')
            .map((pair) => pair.trim())
            .filter(Boolean)
            .reduce((acc, pair) => {
            const [k, v] = pair.split(':');
            if (k && v) {
                acc[k.trim().toLowerCase()] = v.trim().toLowerCase();
            }
            return acc;
        }, {});
    }
    parseSubjectRuleConfig(key, fallback = []) {
        const raw = this.configService.get(key);
        if (!raw) {
            return fallback;
        }
        const parsed = this.parseJson(raw);
        if (!parsed) {
            return fallback;
        }
        return parsed
            .filter((entry) => typeof entry.queue === 'string' && typeof entry.pattern === 'string')
            .map((entry) => ({
            queue: entry.queue.trim().toLowerCase(),
            regex: new RegExp(entry.pattern, entry.flags ?? 'i'),
        }));
    }
    parseJson(value) {
        if (!value) {
            return null;
        }
        try {
            return JSON.parse(value);
        }
        catch (error) {
            this.logger.warn(`Failed to parse JSON for queue configuration: ${error.message}`);
            return null;
        }
    }
    async ensureQueue(tx, resolution) {
        if (this.queueCache.has(resolution.slug)) {
            return this.queueCache.get(resolution.slug).id;
        }
        const record = await tx.inboxQueue.upsert({
            where: { slug: resolution.slug },
            update: {
                isActive: true,
                rules: toJsonUpdate({ lastMatchedRule: resolution.matchedRule }),
            },
            create: {
                slug: resolution.slug,
                name: this.toTitleCase(resolution.slug),
                description: `Queue created via ${resolution.matchedRule} rule`,
                rules: toJsonInput({ bootstrapRule: resolution.matchedRule }),
            },
        });
        this.queueCache.set(record.slug, {
            id: record.id,
            slug: record.slug,
            name: record.name,
        });
        return record.id;
    }
    toTitleCase(value) {
        return value
            .split(/[-_\s]/)
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(' ');
    }
    resolveProvider(account) {
        const metadata = account.metadata ?? undefined;
        const provider = typeof metadata?.provider === 'string'
            ? metadata.provider
            : account.channel.toLowerCase();
        return provider.toLowerCase();
    }
    resolveFolder(folder) {
        const normalized = (folder || 'INBOX').trim();
        if (!normalized) {
            return 'INBOX';
        }
        return normalized.toUpperCase();
    }
    extractListMetadata(message) {
        if (message.metadata && typeof message.metadata === 'object') {
            return { ...message.metadata };
        }
        return {};
    }
    extractBodyMetadata(body) {
        if (body.metadata && typeof body.metadata === 'object') {
            return { ...body.metadata };
        }
        return {};
    }
    extractMetadataString(metadata, key) {
        const value = metadata[key];
        return typeof value === 'string' ? value : null;
    }
    extractHeaderMap(metadata) {
        const headers = metadata.headers;
        if (!headers || typeof headers !== 'object') {
            return undefined;
        }
        return Object.entries(headers).reduce((acc, [key, value]) => {
            if (typeof value === 'string') {
                acc[key.toLowerCase()] = value;
            }
            return acc;
        }, {});
    }
    extractLabels(metadata) {
        const labels = metadata.labels;
        if (!Array.isArray(labels)) {
            return undefined;
        }
        return labels
            .filter((label) => typeof label === 'string' && label.trim().length > 0)
            .map((label) => label.trim());
    }
    extractQueueSlug(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }
        const record = metadata;
        const queue = record.queue;
        if (typeof queue === 'string' && queue.trim()) {
            return queue.trim().toLowerCase();
        }
        const queueSlug = record.queueSlug;
        if (typeof queueSlug === 'string' && queueSlug.trim()) {
            return queueSlug.trim().toLowerCase();
        }
        return null;
    }
    serializeMessage(record) {
        return {
            id: record.id,
            accountId: record.accountId,
            provider: record.provider,
            messageUid: record.messageUid,
            remoteId: record.remoteId,
            threadRemoteId: record.threadRemoteId,
            subject: record.subject,
            snippet: record.snippet,
            previewText: record.previewText,
            from: record.fromAddress || record.fromName
                ? { address: record.fromAddress, name: record.fromName }
                : null,
            to: record.toAddresses,
            cc: record.ccAddresses,
            bcc: record.bccAddresses,
            direction: record.direction,
            folder: record.folder,
            isRead: record.isRead,
            isStarred: record.isStarred,
            isSpam: record.isSpam,
            hasAttachments: record.hasAttachments,
            queueId: record.queueId ?? null,
            queueSlug: record.queue?.slug ?? this.extractQueueSlug(record.metadata),
            queueName: record.queue?.name ?? null,
            sentAt: record.sentAt ? record.sentAt.toISOString() : null,
            receivedAt: record.receivedAt ? record.receivedAt.toISOString() : null,
            metadata: record.metadata ?? null,
        };
    }
    emitBroadcast(eventType, message) {
        this.events.emit({
            type: eventType,
            message,
            queueId: message.queueId ?? null,
            queueSlug: message.queueSlug ?? null,
            accountId: message.accountId,
        });
    }
    serializeMessageDetail(record, body, attachments) {
        const summary = this.serializeMessage(record);
        return {
            ...summary,
            bodyHtml: body.bodyHtml ?? null,
            bodyText: body.bodyText ?? null,
            headers: body.headers ?? undefined,
            attachments: attachments.map((attachment) => ({
                id: attachment.id,
                remoteId: attachment.remoteId,
                fileName: attachment.fileName,
                contentType: attachment.contentType,
                size: attachment.size,
                metadata: attachment.metadata ?? null,
            })),
        };
    }
    buildMessageUpdateFromListItem(message, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(metadata, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
        });
        return {
            provider,
            messageUid,
            threadRemoteId: message.threadRemoteId ?? null,
            subject: message.subject ?? null,
            snippet: message.snippet ?? null,
            previewText: message.previewText ?? null,
            fromAddress: message.from?.address ?? null,
            fromName: message.from?.name ?? null,
            toAddresses: this.normalizeAddressArray(message.to),
            ccAddresses: this.normalizeAddressArray(message.cc),
            bccAddresses: this.normalizeAddressArray(message.bcc),
            direction: message.direction,
            folder,
            queue: { connect: { id: queueId } },
            isRead: message.isRead ?? false,
            isStarred: message.isStarred ?? false,
            isSpam: message.isSpam ?? false,
            hasAttachments: message.hasAttachments ?? false,
            sentAt: message.sentAt ?? null,
            receivedAt: message.receivedAt ?? null,
            bodyHash: bodyHash ?? undefined,
            metadata: toJsonUpdate(mergedMetadata),
        };
    }
    buildMessageCreateFromListItem(account, message, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(metadata, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
        });
        return {
            account: { connect: { id: account.id } },
            channel: account.channel,
            provider,
            messageUid,
            remoteId: message.remoteId,
            threadRemoteId: message.threadRemoteId ?? null,
            subject: message.subject ?? null,
            snippet: message.snippet ?? null,
            previewText: message.previewText ?? null,
            fromAddress: message.from?.address ?? null,
            fromName: message.from?.name ?? null,
            toAddresses: this.normalizeAddressArray(message.to),
            ccAddresses: this.normalizeAddressArray(message.cc),
            bccAddresses: this.normalizeAddressArray(message.bcc),
            replyToAddresses: [],
            direction: message.direction,
            folder,
            queue: { connect: { id: queueId } },
            isRead: message.isRead ?? false,
            isStarred: message.isStarred ?? false,
            isSpam: message.isSpam ?? false,
            hasAttachments: message.hasAttachments ?? false,
            sentAt: message.sentAt ?? null,
            receivedAt: message.receivedAt ?? null,
            bodyHash: bodyHash ?? null,
            metadata: toJsonInput(mergedMetadata ?? null),
        };
    }
    buildMessageUpdateFromBody(body, folder, provider, queueId, bodyHash, metadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(metadata, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
        });
        return {
            provider,
            threadRemoteId: body.threadRemoteId ?? null,
            subject: body.subject ?? null,
            hasAttachments: (body.attachments?.length ?? 0) > 0,
            snippet: this.extractSnippet(body) ?? null,
            previewText: this.extractSnippet(body) ?? null,
            folder,
            queue: { connect: { id: queueId } },
            bodyHash: bodyHash ?? undefined,
            metadata: toJsonUpdate(mergedMetadata),
        };
    }
    buildMessageCreateFromBody(account, body, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(metadata, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
        });
        return {
            account: { connect: { id: account.id } },
            channel: account.channel,
            provider,
            messageUid,
            remoteId: body.remoteId,
            threadRemoteId: body.threadRemoteId ?? null,
            subject: body.subject ?? null,
            snippet: this.extractSnippet(body) ?? null,
            previewText: this.extractSnippet(body) ?? null,
            toAddresses: [],
            ccAddresses: [],
            bccAddresses: [],
            replyToAddresses: [],
            direction: client_1.InboxMessageDirection.INBOUND,
            folder,
            queue: { connect: { id: queueId } },
            isRead: false,
            isStarred: false,
            isSpam: false,
            hasAttachments: (body.attachments?.length ?? 0) > 0,
            metadata: toJsonInput(mergedMetadata ?? null),
            bodyHash: bodyHash ?? null,
        };
    }
    buildMessageUpdateFromSend(payload, result, folder, provider, queueId, bodyHash, metadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(metadata, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
        });
        return {
            provider,
            threadRemoteId: result.threadRemoteId ?? null,
            subject: payload.subject ?? null,
            snippet: this.buildOutgoingSnippet(payload) ?? null,
            previewText: this.buildOutgoingSnippet(payload) ?? null,
            fromAddress: payload.fromAddress ?? null,
            fromName: payload.fromName ?? null,
            toAddresses: payload.to,
            ccAddresses: payload.cc ?? [],
            bccAddresses: payload.bcc ?? [],
            replyToAddresses: payload.replyTo ?? [],
            direction: client_1.InboxMessageDirection.OUTBOUND,
            folder,
            queue: { connect: { id: queueId } },
            isRead: true,
            isStarred: false,
            isSpam: false,
            hasAttachments: (payload.attachments?.length ?? 0) > 0,
            sentAt: new Date(),
            bodyHash: bodyHash ?? undefined,
            metadata: toJsonUpdate(mergedMetadata),
        };
    }
    buildMessageCreateFromSend(account, payload, result, folder, provider, messageUid, queueId, bodyHash, metadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(metadata, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
        });
        return {
            account: { connect: { id: account.id } },
            channel: account.channel,
            provider,
            messageUid,
            remoteId: result.remoteId,
            threadRemoteId: result.threadRemoteId ?? null,
            subject: payload.subject ?? null,
            snippet: this.buildOutgoingSnippet(payload) ?? null,
            previewText: this.buildOutgoingSnippet(payload) ?? null,
            toAddresses: payload.to,
            ccAddresses: payload.cc ?? [],
            bccAddresses: payload.bcc ?? [],
            replyToAddresses: payload.replyTo ?? [],
            direction: client_1.InboxMessageDirection.OUTBOUND,
            folder,
            queue: { connect: { id: queueId } },
            isRead: true,
            isStarred: false,
            isSpam: false,
            hasAttachments: (payload.attachments?.length ?? 0) > 0,
            sentAt: new Date(),
            bodyHash: bodyHash ?? null,
            metadata: toJsonInput(mergedMetadata ?? null),
            fromAddress: payload.fromAddress ?? null,
            fromName: payload.fromName ?? null,
        };
    }
    buildFlagUpdate(flags, existingMetadata, queueResolution) {
        const mergedMetadata = this.mergeMetadata(existingMetadata, flags.metadata ?? undefined);
        const withQueue = queueResolution != null
            ? this.mergeMetadata(mergedMetadata ?? undefined, {
                queue: queueResolution.slug,
                queueRule: queueResolution.matchedRule,
            })
            : mergedMetadata;
        return {
            isRead: flags.seen ?? undefined,
            isStarred: flags.starred ?? undefined,
            isSpam: flags.spam ?? undefined,
            metadata: withQueue !== undefined
                ? toJsonUpdate(withQueue)
                : undefined,
        };
    }
    buildMinimalMessage(account, identifier, flags, folder, provider, messageUid, queueId, queueResolution) {
        const effectiveFolder = this.resolveFolder(folder);
        const providerValue = provider ?? this.resolveProvider(account);
        const messageUidValue = messageUid ??
            (0, message_identity_1.deriveMessageUid)({
                provider: providerValue,
                folder: effectiveFolder,
                remoteId: identifier.remoteId,
            });
        const metadata = this.mergeMetadata(flags?.metadata, {
            queue: queueResolution?.slug ?? this.queueRuleConfig.defaultQueue,
            queueRule: queueResolution?.matchedRule ?? 'default',
        });
        return {
            account: { connect: { id: account.id } },
            channel: account.channel,
            provider: providerValue,
            messageUid: messageUidValue,
            remoteId: identifier.remoteId,
            threadRemoteId: identifier.threadRemoteId ?? null,
            subject: null,
            snippet: null,
            previewText: null,
            toAddresses: [],
            ccAddresses: [],
            bccAddresses: [],
            replyToAddresses: [],
            direction: client_1.InboxMessageDirection.INBOUND,
            folder: effectiveFolder,
            queue: queueId
                ? { connect: { id: queueId } }
                : undefined,
            isRead: flags?.seen ?? false,
            isStarred: flags?.starred ?? false,
            isSpam: flags?.spam ?? false,
            hasAttachments: false,
            metadata: toJsonInput(metadata ?? null),
            bodyHash: null,
        };
    }
    normalizeAddressArray(addresses) {
        if (!Array.isArray(addresses)) {
            return [];
        }
        return addresses
            .map((entry) => (entry?.address || '').trim())
            .filter((value) => value.length > 0);
    }
    extractSnippet(body) {
        const textCandidate = body.bodyText || (body.bodyHtml ? this.stripHtml(body.bodyHtml) : '');
        const normalized = textCandidate?.trim() ?? '';
        if (!normalized) {
            return undefined;
        }
        return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
    }
    buildOutgoingSnippet(payload) {
        const textCandidate = payload.bodyText ||
            (payload.bodyHtml ? this.stripHtml(payload.bodyHtml) : '');
        const normalized = textCandidate.trim();
        if (!normalized) {
            return undefined;
        }
        return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
    }
    mergeMetadata(payloadMetadata, adapterMetadata) {
        const combined = {
            ...(payloadMetadata ?? {}),
            ...(adapterMetadata ?? {}),
        };
        const keys = Object.keys(combined);
        if (keys.length === 0) {
            return null;
        }
        return combined;
    }
    stripHtml(content) {
        return content.replace(/<\/?[^>]+(>|$)/g, ' ');
    }
    buildAttachmentMetadata(attachment) {
        const metadata = {};
        if (attachment.inline !== undefined) {
            metadata.inline = attachment.inline;
        }
        if (attachment.contentId) {
            metadata.contentId = attachment.contentId;
        }
        return Object.keys(metadata).length > 0 ? metadata : null;
    }
    decodeAttachmentInput(attachment) {
        const content = attachment.content?.trim();
        if (!content) {
            throw new common_1.BadRequestException('Attachment content is required when provided.');
        }
        const normalized = this.normalizeAttachmentContent(content);
        return {
            fileName: attachment.fileName,
            contentType: attachment.contentType ?? normalized.contentType,
            content: Buffer.from(normalized.data, normalized.encoding),
            encoding: normalized.encoding,
        };
    }
    normalizeAttachmentContent(content) {
        if (content.startsWith('data:')) {
            const [, meta, payload] = content.match(/^data:(.*?);base64,(.*)$/) || [];
            if (payload) {
                return {
                    data: payload,
                    encoding: 'base64',
                    contentType: meta?.split(';')[0],
                };
            }
        }
        return { data: content, encoding: 'base64', contentType: undefined };
    }
    async recordEvent(tx, messageId, type, payload) {
        await tx.inboxMessageEvent.create({
            data: {
                messageId,
                type,
                payload: toJsonInput(payload ?? null),
            },
        });
    }
    async ensureConfiguredEmailAccount() {
        this.emailAdapter.refreshConfig();
        const sanitized = this.emailAdapter.getSanitizedConfig();
        const emailAddress = sanitized.defaults.fromAddress ||
            this.configService.get('INBOX_EMAIL_USER');
        if (!emailAddress) {
            this.logger.warn('No email inbox account configured. Set INBOX_EMAIL_* environment variables to enable the inbox module.');
            return;
        }
        const normalizedAddress = emailAddress.trim().toLowerCase();
        const displayName = this.configService.get('INBOX_EMAIL_DEFAULT_NAME') ||
            this.configService.get('INBOX_EMAIL_DISPLAY_NAME') ||
            sanitized.defaults.fromName ||
            normalizedAddress;
        const metadata = {
            defaults: sanitized.defaults,
            imap: sanitized.imap,
            smtp: sanitized.smtp,
            limits: sanitized.limits,
            polling: sanitized.polling,
            lastConfigSync: new Date().toISOString(),
        };
        await this.prisma.inboxAccount.upsert({
            where: {
                channel_address: {
                    channel: client_1.InboxChannelType.EMAIL,
                    address: normalizedAddress,
                },
            },
            update: {
                displayName,
                metadata: toJsonInput(metadata),
                active: true,
            },
            create: {
                channel: client_1.InboxChannelType.EMAIL,
                address: normalizedAddress,
                displayName,
                metadata: toJsonInput(metadata),
                active: true,
            },
        });
    }
};
exports.InboxService = InboxService;
exports.InboxService = InboxService = InboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        channel_registry_1.ChannelRegistry,
        email_channel_adapter_1.EmailChannelAdapter,
        inbox_events_service_1.InboxEventsService])
], InboxService);
//# sourceMappingURL=inbox.service.js.map