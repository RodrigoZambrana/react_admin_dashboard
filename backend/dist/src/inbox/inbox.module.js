"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const inbox_controller_1 = require("./inbox.controller");
const inbox_service_1 = require("./inbox.service");
const channel_registry_1 = require("./registry/channel-registry");
const email_channel_adapter_1 = require("./providers/email/email-channel.adapter");
const inbox_events_service_1 = require("./events/inbox-events.service");
let InboxModule = class InboxModule {
};
exports.InboxModule = InboxModule;
exports.InboxModule = InboxModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [inbox_controller_1.InboxController],
        providers: [inbox_service_1.InboxService, channel_registry_1.ChannelRegistry, email_channel_adapter_1.EmailChannelAdapter, inbox_events_service_1.InboxEventsService],
    })
], InboxModule);
//# sourceMappingURL=inbox.module.js.map