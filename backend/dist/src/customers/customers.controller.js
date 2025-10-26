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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const table_query_dto_1 = require("./dto/table-query.dto");
const update_customer_dto_1 = require("./dto/update-customer.dto");
const money_util_1 = require("../common/currency/money.util");
let CustomersController = class CustomersController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    defaultCountryCode = '+598';
    mailCategoryFolders = {
        inbox: ['INBOX', 'Inbox', 'Primary'],
        sentitem: ['Sent', 'Sent Items', 'Sent Mail', 'Sent Messages', '[Gmail]/Sent Mail'],
        draft: ['Draft', 'Drafts', '[Gmail]/Drafts'],
        deleted: ['Trash', 'Deleted', 'Deleted Items', 'Deleted Messages', '[Gmail]/Trash', '[Gmail]/Bin', 'Bin', 'Junk'],
    };
    extractPhoneCandidates(source) {
        if (!Array.isArray(source)) {
            return [];
        }
        return source.map((item) => {
            if (item === undefined || item === null) {
                return '';
            }
            if (typeof item === 'string') {
                return item;
            }
            if (typeof item === 'number' && Number.isFinite(item)) {
                return String(item);
            }
            if (typeof item === 'object' && item !== null && 'phone' in item) {
                const candidate = item.phone;
                if (candidate === undefined || candidate === null) {
                    return '';
                }
                if (typeof candidate === 'string') {
                    return candidate;
                }
                if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                    return String(candidate);
                }
                return String(candidate);
            }
            return String(item);
        }).filter((value) => value.trim().length > 0);
    }
    normalizePhoneValue(input, defaultCountryCode = this.defaultCountryCode) {
        if (input === undefined || input === null) {
            return '';
        }
        const raw = typeof input === 'string'
            ? input
            : typeof input === 'number' && Number.isFinite(input)
                ? String(input)
                : String(input ?? '');
        const trimmed = raw.trim();
        if (!trimmed) {
            return '';
        }
        let normalized = trimmed.replace(/[^\d+]+/g, '');
        if (normalized.startsWith('00')) {
            normalized = `+${normalized.slice(2)}`;
        }
        const hasExplicitPrefix = normalized.startsWith('+');
        if (!hasExplicitPrefix) {
            normalized = `+${normalized}`;
        }
        const digits = normalized.slice(1).replace(/\D/g, '');
        if (!digits) {
            return '';
        }
        const defaultDigits = String(defaultCountryCode || '')
            .replace(/[^\d]/g, '');
        if (hasExplicitPrefix) {
            if (defaultDigits && digits.startsWith(defaultDigits)) {
                const national = digits.slice(defaultDigits.length).replace(/^0+/, '');
                if (national.length) {
                    return `+${defaultDigits}${national}`;
                }
            }
            return `+${digits}`;
        }
        const digitsWithoutLeadingZeros = digits.replace(/^0+/, '');
        if (!digitsWithoutLeadingZeros) {
            return '';
        }
        if (defaultDigits && digitsWithoutLeadingZeros.startsWith(defaultDigits)) {
            return `+${digitsWithoutLeadingZeros}`;
        }
        return defaultDigits
            ? `+${defaultDigits}${digitsWithoutLeadingZeros}`
            : `+${digitsWithoutLeadingZeros}`;
    }
    normalizePhoneList(inputs) {
        const normalized = inputs
            .map((value) => this.normalizePhoneValue(value))
            .filter((phone) => phone.length > 0);
        return Array.from(new Set(normalized));
    }
    mergeEventMetadata(metadata, eventType) {
        const base = metadata && typeof metadata === 'object'
            ? { ...metadata }
            : {};
        if (eventType) {
            base.eventTypeId = eventType.id;
            base.eventTypeName = eventType.name;
            if (eventType.color && !base.color) {
                base.color = eventType.color;
            }
        }
        return Object.keys(base).length > 0 ? base : null;
    }
    serializeEventAttachments(attachments = []) {
        return attachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            type: attachment.mimeType ?? undefined,
            size: attachment.size ?? undefined,
        }));
    }
    normalizeMailCategory(category) {
        if (category === undefined || category === null) {
            return 'inbox';
        }
        const normalized = category
            .toString()
            .trim()
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
        if (!normalized) {
            return 'inbox';
        }
        if (['sent', 'sentitems', 'sentmail', 'sentmessages'].includes(normalized)) {
            return 'sentitem';
        }
        if (['trash', 'bin', 'deleteditems', 'deletedmessages'].includes(normalized)) {
            return 'deleted';
        }
        return normalized;
    }
    buildInboxCategoryWhere(category) {
        const normalized = this.normalizeMailCategory(category);
        if (normalized === 'starred') {
            return { isStarred: true };
        }
        const folders = this.mailCategoryFolders[normalized];
        if (!folders) {
            if (normalized === 'inbox') {
                return { direction: client_1.InboxMessageDirection.INBOUND };
            }
            return null;
        }
        const orConditions = folders.map((folder) => ({
            folder: { equals: folder, mode: 'insensitive' },
        }));
        if (normalized === 'inbox') {
            orConditions.push({ folder: null });
        }
        const where = {};
        if (orConditions.length > 0) {
            where.OR = orConditions;
        }
        if (normalized === 'sentitem') {
            where.direction = client_1.InboxMessageDirection.OUTBOUND;
        }
        else if (normalized === 'inbox') {
            where.direction = client_1.InboxMessageDirection.INBOUND;
        }
        return where;
    }
    resolveMailGroup(message) {
        if (message.isStarred) {
            return 'starred';
        }
        const folder = (message.folder || '').toLowerCase();
        if (folder.includes('draft')) {
            return 'draft';
        }
        if (folder.includes('sent')) {
            return 'sentItem';
        }
        if (folder.includes('trash') || folder.includes('deleted') || folder.includes('bin') || folder.includes('junk')) {
            return 'deleted';
        }
        if (message.direction === client_1.InboxMessageDirection.OUTBOUND) {
            return 'sentItem';
        }
        return 'inbox';
    }
    extractNameFromEmail(address) {
        if (!address) {
            return '';
        }
        const local = address.split('@')[0] || '';
        if (!local) {
            return address;
        }
        return local
            .replace(/[._-]+/g, ' ')
            .split(' ')
            .filter((part) => part.trim().length > 0)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    formatMailDate(input) {
        if (!input) {
            return '';
        }
        const date = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return new Intl.DateTimeFormat('en', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    }
    escapeHtml(input) {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    normalizeMessageMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            return {};
        }
        return metadata;
    }
    resolvePreviewText(message, metadata) {
        const metadataPreview = typeof metadata.previewText === 'string' && metadata.previewText.trim().length
            ? metadata.previewText.trim()
            : typeof metadata.snippet === 'string' && metadata.snippet.trim().length
                ? metadata.snippet.trim()
                : '';
        const storedPreview = typeof message.previewText === 'string' && message.previewText.trim().length
            ? message.previewText.trim()
            : typeof message.snippet === 'string' && message.snippet.trim().length
                ? message.snippet.trim()
                : '';
        const resolved = metadataPreview || storedPreview;
        return resolved || '';
    }
    buildHtmlFromText(input) {
        if (!input || !input.trim().length) {
            return '<p></p>';
        }
        const lines = input.replace(/\r\n/g, '\n').split('\n');
        const rendered = lines
            .map((line) => this.escapeHtml(line.trim()))
            .map((line) => (line.length ? `<p>${line}</p>` : '<p>&nbsp;</p>'))
            .join('');
        return rendered || '<p></p>';
    }
    resolveAttachmentType(fileName, contentType) {
        if (fileName) {
            const parts = fileName.toLowerCase().split('.');
            if (parts.length > 1) {
                const ext = parts.pop();
                if (ext) {
                    return ext;
                }
            }
        }
        if (contentType && contentType.includes('/')) {
            const [, subtype] = contentType.split('/');
            if (subtype) {
                return subtype.toLowerCase();
            }
        }
        return 'file';
    }
    formatAttachmentSize(size) {
        if (size === undefined || size === null || size < 0) {
            return '';
        }
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = size;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        const precision = value >= 100 || unitIndex === 0 ? 0 : 1;
        return `${value.toFixed(precision)}${units[unitIndex]}`;
    }
    buildMailAttachments(attachments = []) {
        return attachments.map((attachment, index) => {
            const file = attachment.fileName?.trim() || `attachment-${index + 1}`;
            return {
                file,
                size: this.formatAttachmentSize(attachment.size),
                type: this.resolveAttachmentType(attachment.fileName, attachment.contentType),
            };
        });
    }
    buildMetadataAttachments(input) {
        if (!Array.isArray(input)) {
            return [];
        }
        return input
            .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const record = item;
            const fileRaw = record.file;
            const file = typeof fileRaw === 'string' ? fileRaw.trim() : '';
            if (!file) {
                return null;
            }
            const sizeValue = typeof record.size === 'number' && Number.isFinite(record.size)
                ? this.formatAttachmentSize(record.size)
                : '';
            const typeValue = typeof record.contentType === 'string' && record.contentType.trim().length
                ? record.contentType.trim()
                : 'file';
            return {
                file,
                size: sizeValue,
                type: typeValue,
            };
        })
            .filter((item) => Boolean(item));
    }
    mapInboxMessageToMail(message) {
        const recipients = Array.isArray(message.toAddresses)
            ? message.toAddresses.map((address) => String(address))
            : [];
        const fromAddress = message.fromAddress ?? '';
        let displayName = message.direction === client_1.InboxMessageDirection.INBOUND
            ? message.fromName || this.extractNameFromEmail(fromAddress)
            : message.fromName || this.extractNameFromEmail(recipients[0]) || this.extractNameFromEmail(fromAddress);
        if (!displayName) {
            displayName = fromAddress || recipients[0] || 'Contact';
        }
        const group = this.resolveMailGroup({
            folder: message.folder ?? null,
            isStarred: message.isStarred,
            direction: message.direction,
        });
        const metadata = this.normalizeMessageMetadata(message.metadata);
        const previewText = this.resolvePreviewText(message, metadata);
        const bodyHtml = typeof metadata.bodyHtml === 'string' ? metadata.bodyHtml : '';
        const bodyText = typeof metadata.bodyText === 'string' ? metadata.bodyText : '';
        const contentHtml = bodyHtml.trim().length > 0
            ? bodyHtml
            : this.buildHtmlFromText(bodyText || previewText || '');
        const attachments = this.buildMailAttachments(message.attachments) ??
            [];
        const metadataAttachments = this.buildMetadataAttachments(metadata.attachments);
        const combinedAttachments = attachments.length > 0 ? attachments : metadataAttachments;
        return {
            id: message.id,
            name: displayName,
            label: '',
            group,
            flagged: Boolean(message.isSpam),
            starred: Boolean(message.isStarred),
            from: fromAddress,
            avatar: '',
            title: message.subject && message.subject.trim().length ? message.subject : 'No subject',
            subject: message.subject && message.subject.trim().length ? message.subject : 'No subject',
            previewText: previewText || null,
            snippet: previewText || null,
            sentAt: message.sentAt ? message.sentAt.toISOString() : null,
            receivedAt: message.receivedAt ? message.receivedAt.toISOString() : null,
            headers: typeof metadata.headers === 'object' && !Array.isArray(metadata.headers) ? metadata.headers : undefined,
            ccAddresses: Array.isArray(message.ccAddresses) ? message.ccAddresses : [],
            bccAddresses: Array.isArray(message.bccAddresses) ? message.bccAddresses : [],
            replyToAddresses: Array.isArray(message.replyToAddresses) ? message.replyToAddresses : [],
            mail: recipients,
            message: [
                {
                    id: `${message.id}:0`,
                    name: displayName,
                    mail: recipients,
                    from: fromAddress,
                    avatar: '',
                    date: this.formatMailDate(message.sentAt ?? message.receivedAt ?? message.createdAt),
                    content: contentHtml,
                    attachment: combinedAttachments,
                },
            ],
        };
    }
    extractUniqueConstraintTargets(error) {
        const target = error.meta?.target;
        if (Array.isArray(target)) {
            return target
                .map((value) => (value ? value.toString() : ''))
                .filter((value) => value.length > 0);
        }
        if (typeof target === 'string' && target.trim().length > 0) {
            return [target.trim()];
        }
        return [];
    }
    throwCustomerUniqueConstraint(error) {
        const targets = this.extractUniqueConstraintTargets(error).map((value) => value.toLowerCase());
        const errors = [];
        if (targets.some((target) => target.includes('email'))) {
            errors.push({
                field: 'email',
                key: 'text.messages.customerEmailTaken',
                message: 'Ya existe un cliente con este correo electrónico.',
            });
        }
        if (targets.some((target) => target.includes('phone'))) {
            errors.push({
                field: 'phoneNumber',
                key: 'text.messages.customerPhoneTaken',
                message: 'Ya existe un cliente con este número de teléfono.',
            });
        }
        const messageKey = errors.length === 1
            ? errors[0].key
            : errors.length > 1
                ? 'text.messages.customerEmailAndPhoneTaken'
                : 'text.messages.customerDuplicate';
        const response = { message: messageKey };
        if (errors.length) {
            response.errors = errors;
        }
        throw new common_1.ConflictException(response);
    }
    async dashboard() {
        const totalCustomers = await this.prisma.customer.count();
        const recent = await this.prisma.customer.findMany({ orderBy: { id: 'desc' }, take: 8 });
        const regions = ['NA', 'EU', 'APAC', 'LATAM', 'MEA'];
        const leadByRegionData = regions.map((r) => ({ name: r, value: Math.max(1, Math.round(totalCustomers / regions.length + Math.random() * 3)) }));
        return {
            statisticData: [
                { key: 'total', label: 'Total customers', value: totalCustomers, growShrink: 0 },
                { key: 'active', label: 'Active customers', value: Math.max(0, totalCustomers - 1), growShrink: 0 },
                { key: 'new', label: 'New customers', value: Math.min(5, totalCustomers), growShrink: 0 },
            ],
            leadByRegionData,
            recentLeadsData: recent.map((c) => ({
                id: c.id,
                name: c.name,
                avatar: c.img || '',
                status: 0,
                createdTime: Math.floor(new Date(c.createdAt).getTime() / 1000),
                email: c.email || '',
                assignee: '',
            })),
            emailSentData: { precent: 25, opened: 50, unopen: 150, total: 200 },
        };
    }
    async queryCustomers(dto) {
        const where = {};
        const rawQuery = typeof dto.query === 'string' ? dto.query.trim() : '';
        if (rawQuery) {
            where.OR = [
                { name: { contains: rawQuery, mode: 'insensitive' } },
                { email: { contains: rawQuery, mode: 'insensitive' } },
                { phoneNumber: { contains: rawQuery, mode: 'insensitive' } },
                {
                    phones: {
                        some: {
                            phone: {
                                contains: rawQuery,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            ];
        }
        const statusFilter = dto.filterData?.statusId;
        if (statusFilter !== undefined &&
            statusFilter !== null &&
            statusFilter !== '' &&
            statusFilter !== 'all') {
            const parsed = Number(statusFilter);
            if (!Number.isNaN(parsed)) {
                where.statusId = parsed;
            }
            else if (typeof statusFilter === 'string') {
                where.status = {
                    name: {
                        equals: statusFilter,
                        mode: 'insensitive',
                    },
                };
            }
        }
        const total = await this.prisma.customer.count({ where });
        const sortKey = (dto.sort?.key || '').toString();
        const sortOrderRaw = (dto.sort?.order || '').toString().toLowerCase();
        const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;
        const orderBy = [];
        if (sortKey && sortOrder) {
            switch (sortKey) {
                case 'name':
                    orderBy.push({ name: sortOrder });
                    break;
                case 'email':
                    orderBy.push({ email: sortOrder });
                    break;
                case 'phoneNumber':
                    orderBy.push({ phoneNumber: sortOrder });
                    break;
                case 'status':
                    orderBy.push({ status: { name: sortOrder } });
                    break;
            }
        }
        orderBy.push({ id: 'desc' });
        const customerListInclude = {
            addresses: { select: { id: true, isPrimary: true } },
            status: true,
            phones: {
                select: {
                    phone: true,
                    isPrimary: true,
                },
            },
        };
        const rows = await this.prisma.customer.findMany({
            where,
            orderBy,
            skip: (dto.pageIndex - 1) * dto.pageSize,
            take: dto.pageSize,
            include: customerListInclude,
        });
        const data = rows.map((customer) => {
            const { addresses, status, phones, ...rest } = customer;
            const sortedPhones = (phones || []).sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
            const phoneNumbers = sortedPhones.map((p) => p.phone);
            return {
                ...rest,
                email: rest.email || '',
                firstName: rest.firstName || '',
                lastName: rest.lastName || '',
                statusId: customer.statusId ?? null,
                status: status?.name || '',
                statusName: status?.name || '',
                statusColor: status?.color || null,
                hasPrimaryAddress: (addresses || []).some((addr) => addr.isPrimary),
                phoneNumber: phoneNumbers[0] || rest.phoneNumber || '',
                phoneNumbers,
            };
        });
        return { data, total };
    }
    async putCustomer(dto) {
        const id = Number(dto.id ?? 0);
        const personal = dto.personalInfo && typeof dto.personalInfo === 'object'
            ? dto.personalInfo
            : {};
        const rawFirstName = typeof dto.firstName === 'string'
            ? dto.firstName
            : typeof personal.firstName === 'string'
                ? personal.firstName
                : '';
        const rawLastName = typeof dto.lastName === 'string'
            ? dto.lastName
            : typeof personal.lastName === 'string'
                ? personal.lastName
                : '';
        const firstName = rawFirstName.trim();
        const lastName = rawLastName.trim();
        const providedName = typeof dto.name === 'string' && dto.name.trim().length ? dto.name.trim() : '';
        const name = providedName || [firstName, lastName].filter(Boolean).join(' ');
        const coalesce = (primary, fallback) => primary !== undefined ? primary : fallback;
        const statusRaw = dto.statusId ?? dto.status?.id ?? dto?.status ?? dto.statusName ?? null;
        let statusId;
        if (statusRaw === null || statusRaw === undefined) {
            statusId = undefined;
        }
        else if (statusRaw === '') {
            statusId = null;
        }
        else if (typeof statusRaw === 'number') {
            statusId = Number.isNaN(statusRaw) ? undefined : statusRaw;
        }
        else {
            const parsed = Number(statusRaw);
            statusId = Number.isNaN(parsed) ? undefined : parsed;
        }
        if (typeof statusId === 'number') {
            const statusExists = await this.prisma.customerStatus.findUnique({
                where: { id: statusId },
            });
            if (!statusExists) {
                statusId = undefined;
            }
        }
        const birthdaySource = personal.birthday ?? dto.birthday ?? dto.personalInfo?.birthday;
        let phoneCandidates = [];
        if (Array.isArray(dto.phoneNumbers) && dto.phoneNumbers.length) {
            phoneCandidates = this.extractPhoneCandidates(dto.phoneNumbers);
        }
        else if (Array.isArray(personal.phoneNumbers) && personal.phoneNumbers.length) {
            phoneCandidates = this.extractPhoneCandidates(personal.phoneNumbers);
        }
        else {
            const legacyPhone = coalesce(personal.phoneNumber, dto.phoneNumber);
            if (legacyPhone !== undefined && legacyPhone !== null) {
                phoneCandidates = [legacyPhone];
            }
        }
        let phoneNumbers = this.normalizePhoneList(phoneCandidates);
        if (!phoneNumbers.length && id) {
            const existingCustomer = await this.prisma.customer.findUnique({
                where: { id },
                select: {
                    phoneNumber: true,
                    phones: {
                        select: {
                            phone: true,
                            isPrimary: true,
                        },
                    },
                },
            });
            if (existingCustomer) {
                const sortedExistingPhones = (existingCustomer.phones || []).sort((a, b) => a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1);
                const fallbackPhones = sortedExistingPhones.length
                    ? sortedExistingPhones.map((entry) => entry.phone)
                    : existingCustomer.phoneNumber
                        ? [existingCustomer.phoneNumber]
                        : [];
                if (fallbackPhones.length) {
                    phoneNumbers = this.normalizePhoneList(fallbackPhones);
                }
            }
        }
        if (!phoneNumbers.length) {
            throw new common_1.BadRequestException({
                message: 'text.validation.phoneNumberRequired',
                errors: [
                    {
                        field: 'phoneNumbers',
                        key: 'text.validation.phoneNumberRequired',
                    },
                ],
            });
        }
        const emailSource = dto.email !== undefined
            ? dto.email
            : personal.email !== undefined
                ? personal.email
                : undefined;
        const img = dto.img;
        const location = coalesce(personal.location, dto.location);
        const titleValue = coalesce(personal.title, dto.title);
        const facebookValue = coalesce(personal.facebook, dto.facebook);
        const twitterValue = coalesce(personal.twitter, dto.twitter);
        const pinterestValue = coalesce(personal.pinterest, dto.pinterest);
        const linkedInValue = coalesce(personal.linkedIn, dto.linkedIn);
        const createData = {
            name,
            firstName: firstName || null,
            lastName: lastName || null,
            phoneNumber: phoneNumbers[0] ?? null,
        };
        if (img !== undefined) {
            createData.img = img;
        }
        if (location !== undefined) {
            createData.location = location;
        }
        if (titleValue !== undefined) {
            createData.title = titleValue;
        }
        if (facebookValue !== undefined) {
            createData.facebook = facebookValue;
        }
        if (twitterValue !== undefined) {
            createData.twitter = twitterValue;
        }
        if (pinterestValue !== undefined) {
            createData.pinterest = pinterestValue;
        }
        if (linkedInValue !== undefined) {
            createData.linkedIn = linkedInValue;
        }
        if (emailSource !== undefined) {
            createData.email = emailSource;
        }
        if (birthdaySource !== undefined) {
            createData.birthday = birthdaySource
                ? new Date(birthdaySource)
                : null;
        }
        if (statusId !== undefined) {
            createData.statusId = statusId;
        }
        const updateData = { ...createData };
        let customer;
        try {
            if (id) {
                customer = await this.prisma.customer.update({
                    where: { id },
                    data: updateData,
                });
            }
            else {
                if (createData.statusId === undefined) {
                    const activeStatus = await this.prisma.customerStatus.upsert({
                        where: {
                            name: 'Active',
                        },
                        update: {},
                        create: {
                            name: 'Active',
                            color: '#10B981',
                        },
                    });
                    createData.statusId = activeStatus.id;
                }
                customer = await this.prisma.customer.create({
                    data: createData,
                });
            }
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                this.throwCustomerUniqueConstraint(error);
            }
            throw error;
        }
        const customerId = customer.id;
        if (customerId) {
            await this.prisma.customerPhone.deleteMany({ where: { customerId } });
            if (phoneNumbers.length) {
                await this.prisma.customerPhone.createMany({
                    data: phoneNumbers.map((phone, index) => ({
                        customerId,
                        phone,
                        isPrimary: index === 0,
                    })),
                });
            }
            if (dto.address) {
                const addr = dto.address || {};
                const normalizeNullable = (value) => {
                    if (value === undefined || value === null) {
                        return null;
                    }
                    const stringified = String(value).trim();
                    return stringified.length > 0 ? stringified : null;
                };
                const addressData = {
                    street: String(addr.street || '').trim(),
                    number: String(addr.number || '').trim(),
                    corner: normalizeNullable(addr.corner),
                    apartment: normalizeNullable(addr.apartment),
                    city: String(addr.city || '').trim(),
                    country: String(addr.country || '').trim(),
                    comments: normalizeNullable(addr.comments),
                    isPrimary: true,
                };
                const hasMeaningfulData = [
                    addressData.street,
                    addressData.number,
                    addressData.city,
                    addressData.country,
                ].some((value) => Boolean(String(value || '').trim()));
                if (hasMeaningfulData) {
                    const existingPrimary = await this.prisma.customerAddress.findFirst({
                        where: { customerId, isPrimary: true },
                    });
                    if (existingPrimary) {
                        await this.prisma.customerAddress.update({
                            where: { id: existingPrimary.id },
                            data: {
                                ...addressData,
                            },
                        });
                    }
                    else {
                        await this.prisma.customerAddress.create({
                            data: {
                                customerId,
                                ...addressData,
                            },
                        });
                    }
                }
            }
        }
        const updated = await this.prisma.customer.findUnique({
            where: { id: customerId },
            include: { status: true, phones: true, addresses: true },
        });
        if (!updated)
            return null;
        const { phones, ...rest } = updated;
        const sortedPhones = (phones || []).sort((a, b) => a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1);
        const finalPhoneNumbers = sortedPhones.map((p) => p.phone);
        return {
            ...rest,
            firstName: rest.firstName || '',
            lastName: rest.lastName || '',
            email: rest.email || '',
            phoneNumber: rest.phoneNumber || finalPhoneNumbers[0] || null,
            phoneNumbers: finalPhoneNumbers,
        };
    }
    async calendar(projectId, createdById, taskId) {
        const where = {};
        if (projectId)
            where.projectId = Number(projectId);
        if (createdById)
            where.createdById = Number(createdById);
        if (taskId)
            where.taskId = Number(taskId);
        const events = await this.prisma.calendarEvent.findMany({
            where,
            orderBy: { startAt: 'asc' },
            include: { eventType: true, attachments: true },
        });
        const normalized = events.map((event) => {
            const { attachments = [], ...rest } = event;
            return {
                ...rest,
                attachments: this.serializeEventAttachments(attachments),
                color: rest.color || rest.eventType?.color || null,
                metadata: this.mergeEventMetadata(rest.metadata, rest.eventType ?? undefined),
            };
        });
        return { events: normalized };
    }
    async listCustomerMails(category) {
        const where = this.buildInboxCategoryWhere(category);
        if (!where) {
            return [];
        }
        const orderBy = [
            { sentAt: 'desc' },
            { receivedAt: 'desc' },
            { createdAt: 'desc' },
        ];
        const messages = await this.prisma.inboxMessage.findMany({
            where,
            orderBy,
            include: { attachments: true },
            take: 50,
        });
        return messages.map((message) => this.mapInboxMessageToMail(message));
    }
    async getCustomerMail(id) {
        const normalizedId = typeof id === 'string' ? id.trim() : '';
        if (!normalizedId) {
            throw new common_1.BadRequestException('Mail id is required');
        }
        const message = await this.prisma.inboxMessage.findUnique({
            where: { id: normalizedId },
            include: { attachments: true },
        });
        if (!message) {
            throw new common_1.NotFoundException('Mail not found');
        }
        return this.mapInboxMessageToMail(message);
    }
    async customerDetails(id) {
        const customer = await this.prisma.customer.findUnique({
            where: { id },
            include: {
                addresses: true,
                status: true,
                phones: true,
                orders: {
                    where: { documentType: client_1.DocumentType.ORDER },
                    include: {
                        items: true,
                        status: true,
                    },
                    orderBy: { date: 'desc' },
                },
            },
        });
        if (!customer)
            return null;
        const orders = (customer.orders || []).map((o) => {
            const amount = (0, money_util_1.decimalToNumber)(o.grandTotal, 2);
            const currencyRaw = typeof o.orderCurrency === 'string' ? o.orderCurrency.trim() : '';
            const currency = currencyRaw.length ? currencyRaw : undefined;
            return {
                id: String(o.id),
                status: o.status?.name || '',
                statusCode: o.status?.code,
                amount,
                currency,
                date: Math.floor(new Date(o.date).getTime() / 1000),
                itemCount: (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0),
            };
        });
        const budgetsRaw = await this.prisma.order.findMany({
            where: { customerId: id, documentType: client_1.DocumentType.BUDGET },
            include: { items: true, status: true },
            orderBy: { date: 'desc' },
        });
        const budgets = budgetsRaw.map((o) => {
            const amount = (0, money_util_1.decimalToNumber)(o.grandTotal, 2);
            const currencyRaw = typeof o.orderCurrency === 'string' ? o.orderCurrency.trim() : '';
            const currency = currencyRaw.length ? currencyRaw : undefined;
            return {
                id: String(o.id),
                status: o.status?.name || '',
                statusCode: o.status?.code,
                amount,
                currency,
                date: Math.floor(new Date(o.date).getTime() / 1000),
                itemCount: (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0),
            };
        });
        const phoneNumbers = (customer.phones || [])
            .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
            .map((p) => p.phone);
        const metadataFilters = [];
        const customerIdString = String(customer.id);
        const customerIdNumber = customer.id;
        const metadataPaths = ['customerId', 'customerID', 'crmId', 'userId', 'linkedCustomerId', 'linkedUserId'];
        for (const path of metadataPaths) {
            metadataFilters.push({ metadata: { path: [path], equals: customerIdString } });
            metadataFilters.push({ metadata: { path: [path], equals: customerIdNumber } });
        }
        const activitiesRaw = metadataFilters.length > 0
            ? await this.prisma.calendarEvent.findMany({
                where: { OR: metadataFilters },
                orderBy: { startAt: 'desc' },
                take: 50,
                include: {
                    eventType: true,
                },
            })
            : [];
        const activities = activitiesRaw.map((event) => {
            const metadata = this.mergeEventMetadata(event.metadata, event.eventType ?? undefined);
            const color = event.color ||
                event.eventType?.color ||
                (metadata && typeof metadata === 'object' ? metadata.color : null) ||
                null;
            const eventTypeName = (metadata && typeof metadata === 'object'
                ? metadata.eventTypeName
                : undefined) ||
                event.eventType?.name ||
                event.type ||
                '';
            const startTimestamp = Math.floor(new Date(event.startAt).getTime() / 1000);
            const endTimestamp = event.endAt ? Math.floor(new Date(event.endAt).getTime() / 1000) : null;
            const locationLabel = (metadata && typeof metadata === 'object'
                ? metadata.locationLabel
                : undefined) || event.location || '';
            return {
                id: String(event.id),
                title: event.title,
                description: event.description || '',
                type: eventTypeName,
                color,
                startDate: startTimestamp,
                endDate: endTimestamp,
                allDay: Boolean(event.allDay),
                location: locationLabel,
            };
        });
        return {
            id: String(customer.id),
            name: customer.name,
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            email: customer.email || '',
            img: customer.img || '',
            role: customer.title || '',
            lastOnline: Math.floor(customer.updatedAt.getTime() / 1000),
            status: customer.status?.name || '',
            phoneNumber: phoneNumbers[0] || customer.phoneNumber || '',
            phoneNumbers,
            personalInfo: {
                location: customer.location || '',
                title: customer.title || '',
                birthday: customer.birthday
                    ? customer.birthday.toISOString().split('T')[0]
                    : '',
                phoneNumber: phoneNumbers[0] || customer.phoneNumber || '',
                phoneNumbers,
                facebook: customer.facebook || '',
                twitter: customer.twitter || '',
                pinterest: customer.pinterest || '',
                linkedIn: customer.linkedIn || '',
            },
            addresses: customer.addresses,
            orders,
            budgets,
            activities,
        };
    }
    async listAddresses(customerId) {
        return this.prisma.customerAddress.findMany({
            where: { customerId },
            orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
        });
    }
    normalizeNullable(value) {
        if (value === undefined || value === null)
            return null;
        const stringified = String(value).trim();
        return stringified.length ? stringified : null;
    }
    trimOrEmpty(value) {
        return String(value ?? '').trim();
    }
    async createAddress(customerId, body) {
        const created = await this.prisma.customerAddress.create({
            data: {
                customerId,
                street: this.trimOrEmpty(body.street),
                number: this.trimOrEmpty(body.number),
                corner: this.normalizeNullable(body.corner),
                apartment: this.normalizeNullable(body.apartment),
                city: this.trimOrEmpty(body.city),
                country: this.trimOrEmpty(body.country),
                comments: this.normalizeNullable(body.comments),
                isPrimary: Boolean(body.isPrimary),
            },
        });
        if (created.isPrimary) {
            await this.prisma.customerAddress.updateMany({
                where: { customerId, NOT: { id: created.id } },
                data: { isPrimary: false },
            });
        }
        return created;
    }
    async updateAddress(customerId, id, body) {
        const updated = await this.prisma.customerAddress.update({
            where: { id, customerId },
            data: {
                street: this.trimOrEmpty(body.street),
                number: this.trimOrEmpty(body.number),
                corner: this.normalizeNullable(body.corner),
                apartment: this.normalizeNullable(body.apartment),
                city: this.trimOrEmpty(body.city),
                country: this.trimOrEmpty(body.country),
                comments: this.normalizeNullable(body.comments),
                isPrimary: Boolean(body.isPrimary),
            },
        });
        if (updated.isPrimary) {
            await this.prisma.customerAddress.updateMany({
                where: { customerId, NOT: { id: updated.id } },
                data: { isPrimary: false },
            });
        }
        return updated;
    }
    async setPrimaryAddress(customerId, id) {
        const addr = await this.prisma.customerAddress.findUnique({ where: { id, customerId } });
        if (!addr)
            return false;
        await this.prisma.$transaction([
            this.prisma.customerAddress.updateMany({ where: { customerId }, data: { isPrimary: false } }),
            this.prisma.customerAddress.update({ where: { id: addr.id }, data: { isPrimary: true } }),
        ]);
        return true;
    }
    async deleteAddress(customerId, id) {
        await this.prisma.customerAddress.delete({ where: { id, customerId } });
        return true;
    }
    async deleteCustomer(id) {
        const hasOrders = await this.prisma.order.count({ where: { customerId: id } });
        if (hasOrders > 0) {
            throw new common_1.BadRequestException('text.messages.customerDeleteHasOrders');
        }
        await this.prisma.customer.delete({ where: { id } });
        return true;
    }
    async customersStatistic() {
        const total = await this.prisma.customer.count();
        const potentialActiveStatuses = await this.prisma.customerStatus.findMany({
            where: {
                OR: [
                    { name: { equals: 'Active', mode: 'insensitive' } },
                    { name: { equals: 'Activo', mode: 'insensitive' } },
                ],
            },
            select: { id: true },
        });
        let active = 0;
        if (potentialActiveStatuses.length > 0) {
            active = await this.prisma.customer.count({
                where: { statusId: { in: potentialActiveStatuses.map((s) => s.id) } },
            });
        }
        else {
            active = await this.prisma.customer.count({
                where: {
                    OR: [
                        { status: null },
                        {
                            status: {
                                name: {
                                    contains: 'active',
                                    mode: 'insensitive',
                                },
                            },
                        },
                        {
                            status: {
                                name: {
                                    contains: 'activo',
                                    mode: 'insensitive',
                                },
                            },
                        },
                    ],
                },
            });
        }
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newCustomers = await this.prisma.customer.count({
            where: { createdAt: { gte: startOfMonth } },
        });
        return {
            totalCustomers: { value: total },
            activeCustomers: { value: active },
            newCustomers: { value: newCustomers },
        };
    }
};
exports.CustomersController = CustomersController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('query'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [table_query_dto_1.TableQueryDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "queryCustomers", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_customer_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "putCustomer", null);
__decorate([
    (0, common_1.Get)('calendar'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('createdById')),
    __param(2, (0, common_1.Query)('taskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "calendar", null);
__decorate([
    (0, common_1.Get)('mails'),
    __param(0, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "listCustomerMails", null);
__decorate([
    (0, common_1.Get)('mail'),
    __param(0, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "getCustomerMail", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "customerDetails", null);
__decorate([
    (0, common_1.Get)(':id/addresses'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "listAddresses", null);
__decorate([
    (0, common_1.Post)(':id/addresses'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "createAddress", null);
__decorate([
    (0, common_1.Put)(':customerId/addresses/:id'),
    __param(0, (0, common_1.Param)('customerId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "updateAddress", null);
__decorate([
    (0, common_1.Put)(':customerId/addresses/:id/set-primary'),
    __param(0, (0, common_1.Param)('customerId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "setPrimaryAddress", null);
__decorate([
    (0, common_1.Delete)(':customerId/addresses/:id'),
    __param(0, (0, common_1.Param)('customerId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "deleteAddress", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "deleteCustomer", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "customersStatistic", null);
exports.CustomersController = CustomersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('customers'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersController);
//# sourceMappingURL=customers.controller.js.map