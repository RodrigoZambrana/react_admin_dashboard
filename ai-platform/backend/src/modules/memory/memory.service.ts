import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';

type MemoryEntry = {
  role: 'user' | 'assistant';
  content: string;
};

@Injectable()
export class MemoryService implements OnModuleDestroy {
  private readonly fallbackStore = new Map<string, MemoryEntry[]>();
  private readonly redis: Redis | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PipelineLoggerService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = redisUrl ? new Redis(redisUrl, { lazyConnect: true }) : null;
  }

  async append(
    conversationId: string,
    role: MemoryEntry['role'],
    content: string,
  ) {
    const key = this.keyForConversation(conversationId);
    const entry = JSON.stringify({ role, content });

    try {
      if (this.redis) {
        await this.redis.connect().catch(() => undefined);
        await this.redis.rpush(key, entry);
        await this.redis.ltrim(key, -20, -1);
        return;
      }
    } catch (error) {
      this.logger.warn(`Redis memory append failed, falling back to in-process store: ${String(error)}`);
    }

    const current = this.fallbackStore.get(key) ?? [];
    current.push({ role, content });
    this.fallbackStore.set(key, current.slice(-20));
  }

  async getRecent(conversationId: string, limit = 10): Promise<MemoryEntry[]> {
    const key = this.keyForConversation(conversationId);

    try {
      if (this.redis) {
        await this.redis.connect().catch(() => undefined);
        const values = await this.redis.lrange(key, -limit, -1);
        return values.map((value) => JSON.parse(value) as MemoryEntry);
      }
    } catch (error) {
      this.logger.warn(`Redis memory read failed, falling back to in-process store: ${String(error)}`);
    }

    return (this.fallbackStore.get(key) ?? []).slice(-limit);
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private keyForConversation(conversationId: string) {
    return `${this.tenantContext.getTenantId()}:conversation:${conversationId}:memory`;
  }
}
