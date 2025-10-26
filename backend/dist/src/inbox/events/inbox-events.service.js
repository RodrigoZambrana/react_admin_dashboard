"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxEventsService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let InboxEventsService = class InboxEventsService {
    stream = new rxjs_1.Subject();
    eventCounter = 0;
    emit(event) {
        this.stream.next(event);
    }
    streamEvents(filterOptions = {}) {
        const queueId = filterOptions.queueId?.toLowerCase();
        const queueSlug = filterOptions.queueSlug?.toLowerCase();
        const accountId = filterOptions.accountId;
        return this.stream.asObservable().pipe((0, operators_1.filter)((event) => {
            if (queueId && event.queueId?.toLowerCase() !== queueId) {
                return false;
            }
            if (queueSlug) {
                const eventSlug = event.queueSlug?.toLowerCase();
                if (eventSlug !== queueSlug) {
                    return false;
                }
            }
            if (accountId && event.accountId !== accountId) {
                return false;
            }
            return true;
        }), (0, operators_1.map)((event) => ({
            type: event.type,
            data: event.message,
            id: event.id ?? this.buildEventId(),
        })));
    }
    buildEventId() {
        this.eventCounter += 1;
        return `${Date.now().toString(36)}-${this.eventCounter.toString(36)}`;
    }
};
exports.InboxEventsService = InboxEventsService;
exports.InboxEventsService = InboxEventsService = __decorate([
    (0, common_1.Injectable)()
], InboxEventsService);
//# sourceMappingURL=inbox-events.service.js.map