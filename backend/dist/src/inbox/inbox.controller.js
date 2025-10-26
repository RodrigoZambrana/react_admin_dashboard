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
exports.InboxController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const inbox_service_1 = require("./inbox.service");
const list_messages_dto_1 = require("./dto/list-messages.dto");
const send_message_dto_1 = require("./dto/send-message.dto");
const update_flags_dto_1 = require("./dto/update-flags.dto");
const move_message_dto_1 = require("./dto/move-message.dto");
const sync_mailbox_dto_1 = require("./dto/sync-mailbox.dto");
const get_message_dto_1 = require("./dto/get-message.dto");
let InboxController = class InboxController {
    inboxService;
    constructor(inboxService) {
        this.inboxService = inboxService;
    }
    listAccounts() {
        return this.inboxService.listAccounts();
    }
    listMailboxes(accountId) {
        return this.inboxService.listMailboxes(accountId);
    }
    listMessages(accountId, query) {
        return this.inboxService.listMessages(accountId, {
            mailbox: query.mailbox,
            cursor: query.cursor,
            limit: query.limit,
            since: query.since,
        });
    }
    getMessage(accountId, remoteId, query) {
        return this.inboxService.getMessage(accountId, {
            remoteId,
            threadRemoteId: query.threadRemoteId,
        });
    }
    sendMessage(accountId, body) {
        return this.inboxService.sendMessage(accountId, {
            subject: body.subject,
            to: body.to,
            cc: body.cc,
            bcc: body.bcc,
            replyTo: body.replyTo,
            replyToRemoteId: body.replyToRemoteId,
            bodyHtml: body.bodyHtml,
            bodyText: body.bodyText,
            attachments: body.attachments?.map((attachment) => ({
                fileName: attachment.fileName,
                contentType: attachment.contentType,
                content: attachment.content,
            })),
            metadata: body.metadata,
            fromAddress: body.fromAddress,
            fromName: body.fromName,
            queueId: body.queueId,
            queueSlug: body.queueSlug,
        });
    }
    updateFlags(accountId, remoteId, body) {
        return this.inboxService.setFlags(accountId, {
            remoteId,
            threadRemoteId: body.threadRemoteId,
        }, {
            seen: body.seen,
            starred: body.starred,
            spam: body.spam,
            metadata: body.metadata,
        });
    }
    moveMessage(accountId, remoteId, body) {
        return this.inboxService.moveMessage(accountId, {
            remoteId,
            threadRemoteId: body.threadRemoteId,
        }, body.targetMailbox);
    }
    markAsSpam(accountId, remoteId, body) {
        return this.inboxService.markAsSpam(accountId, {
            remoteId,
            threadRemoteId: body.threadRemoteId,
        });
    }
    syncAccount(accountId, body) {
        return this.inboxService.synchronizeAccount(accountId, {
            mailboxes: body.mailboxes,
            limit: body.limit,
            cursor: body.cursor,
            since: body.since,
        });
    }
    streamMessages(queueId, queueSlug, accountId) {
        return this.inboxService.streamMessageEvents({
            queueId,
            queueSlug,
            accountId,
        });
    }
};
exports.InboxController = InboxController;
__decorate([
    (0, common_1.Get)('accounts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "listAccounts", null);
__decorate([
    (0, common_1.Get)('accounts/:accountId/mailboxes'),
    __param(0, (0, common_1.Param)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "listMailboxes", null);
__decorate([
    (0, common_1.Get)('accounts/:accountId/messages'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_messages_dto_1.ListMessagesQueryDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "listMessages", null);
__decorate([
    (0, common_1.Get)('accounts/:accountId/messages/:remoteId'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Param)('remoteId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, get_message_dto_1.GetMessageQueryDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "getMessage", null);
__decorate([
    (0, common_1.Post)('accounts/:accountId/messages/send'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_message_dto_1.SendMessageDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('accounts/:accountId/messages/:remoteId/flags'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Param)('remoteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_flags_dto_1.UpdateFlagsDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "updateFlags", null);
__decorate([
    (0, common_1.Post)('accounts/:accountId/messages/:remoteId/move'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Param)('remoteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, move_message_dto_1.MoveMessageDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "moveMessage", null);
__decorate([
    (0, common_1.Post)('accounts/:accountId/messages/:remoteId/spam'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Param)('remoteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_flags_dto_1.UpdateFlagsDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "markAsSpam", null);
__decorate([
    (0, common_1.Post)('accounts/:accountId/sync'),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sync_mailbox_dto_1.SyncMailboxDto]),
    __metadata("design:returntype", void 0)
], InboxController.prototype, "syncAccount", null);
__decorate([
    (0, common_1.Sse)('events/messages'),
    __param(0, (0, common_1.Query)('queueId')),
    __param(1, (0, common_1.Query)('queueSlug')),
    __param(2, (0, common_1.Query)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Function)
], InboxController.prototype, "streamMessages", null);
exports.InboxController = InboxController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('inbox'),
    __metadata("design:paramtypes", [inbox_service_1.InboxService])
], InboxController);
//# sourceMappingURL=inbox.controller.js.map