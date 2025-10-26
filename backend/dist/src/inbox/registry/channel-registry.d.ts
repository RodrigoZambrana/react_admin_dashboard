import { InboxChannelType } from '@prisma/client';
import { ChannelAdapter } from '../types/channel-adapter';
export declare class ChannelRegistry {
    private readonly logger;
    private readonly adapters;
    register(adapter: ChannelAdapter): void;
    getAdapter(type: InboxChannelType): ChannelAdapter;
    listAdapters(): ChannelAdapter[];
}
