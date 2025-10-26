import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
export type InboxBroadcast = {
    type: string;
    message: Record<string, unknown>;
    queueId?: string | null;
    queueSlug?: string | null;
    accountId?: string;
    id?: string;
};
export type InboxStreamFilter = {
    queueId?: string;
    queueSlug?: string;
    accountId?: string;
};
export declare class InboxEventsService {
    private readonly stream;
    private eventCounter;
    emit(event: InboxBroadcast): void;
    streamEvents(filterOptions?: InboxStreamFilter): Observable<MessageEvent>;
    private buildEventId;
}
