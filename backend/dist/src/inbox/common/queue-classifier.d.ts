import type { QueueClassificationInput } from './message-identity';
export type QueueRuleConfig = {
    headerKey?: string;
    domainQueues?: Record<string, string>;
    aliasQueues?: Record<string, string>;
    subjectRules?: Array<{
        regex: RegExp;
        queue: string;
    }>;
    labelQueues?: Record<string, string>;
    defaultQueue: string;
};
export type QueueResolution = {
    slug: string;
    matchedRule: string;
};
export declare function resolveQueueSlug(input: QueueClassificationInput, config?: QueueRuleConfig): QueueResolution;
