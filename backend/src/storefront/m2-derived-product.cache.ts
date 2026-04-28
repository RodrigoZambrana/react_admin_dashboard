import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

type CachedDerivedProductBundle<T> = {
  baseProductId: number
  priceVersion: string
  updatedAt: string
  value: T
}

@Injectable()
export class M2DerivedProductCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(M2DerivedProductCacheService.name)
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly memoryCache = new Map<string, { payload: string; baseProductId: number; updatedAt: string; expiresAt: number }>()
  private redis: Redis | null = null

  constructor(private readonly config: ConfigService) {
    this.ttlMs = Number(this.config.get<string>('DERIVED_PRODUCTS_CACHE_TTL_MS') ?? '600000')
    this.maxEntries = Number(this.config.get<string>('DERIVED_PRODUCTS_CACHE_MAX_ENTRIES') ?? '250')
  }

  async onModuleInit() {
    const disabled = (this.config.get<string>('DERIVED_PRODUCTS_CACHE_DISABLED') ?? 'false').toLowerCase() === 'true'
    const connectionString =
      this.config.get<string>('DERIVED_PRODUCTS_CACHE_REDIS_URL') ||
      this.config.get<string>('QUEUE_REDIS_URL') ||
      this.config.get<string>('REDIS_URL')

    if (disabled || !connectionString) {
      if (!connectionString) {
        this.logger.warn('No Redis connection string provided for derived products cache. Using in-memory LRU cache only.')
      }
      return
    }

    this.redis = new Redis(connectionString, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }

  async onModuleDestroy() {
    if (!this.redis) {
      return
    }
    try {
      await this.redis.quit()
    } catch (error) {
      this.logger.error(`Failed to close Redis connection: ${(error as Error).message}`)
    } finally {
      this.redis = null
    }
  }

  private touchMemoryEntry(key: string) {
    const entry = this.memoryCache.get(key)
    if (!entry) {
      return
    }
    this.memoryCache.delete(key)
    this.memoryCache.set(key, entry)
  }

  private setMemoryEntry(key: string, entry: { payload: string; baseProductId: number; updatedAt: string; expiresAt: number }) {
    this.memoryCache.set(key, entry)
    this.touchMemoryEntry(key)
    while (this.memoryCache.size > this.maxEntries) {
      const oldestKey = this.memoryCache.keys().next().value as string | undefined
      if (!oldestKey) {
        break
      }
      this.memoryCache.delete(oldestKey)
    }
  }

  private readMemoryEntry(key: string) {
    const entry = this.memoryCache.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key)
      return null
    }
    this.touchMemoryEntry(key)
    return entry
  }

  private async readRedisEntry(key: string) {
    if (!this.redis) {
      return null
    }
    try {
      const payload = await this.redis.get(key)
      if (!payload) {
        return null
      }
      const parsed = JSON.parse(payload) as { baseProductId?: number; updatedAt?: string; value?: unknown }
      if (
        typeof parsed?.baseProductId !== 'number' ||
        typeof parsed?.updatedAt !== 'string' ||
        parsed.value === undefined
      ) {
        return null
      }
      return {
        payload,
        baseProductId: parsed.baseProductId,
        updatedAt: parsed.updatedAt,
      }
    } catch (error) {
      this.logger.warn(`Derived products cache Redis read failed for ${key}: ${(error as Error).message}`)
      return null
    }
  }

  async get<T>(key: string, options?: { updatedAt?: Date | string | number }): Promise<T | null> {
    const minUpdatedAt =
      options?.updatedAt instanceof Date
        ? options.updatedAt.getTime()
        : typeof options?.updatedAt === 'string'
          ? new Date(options.updatedAt).getTime()
          : typeof options?.updatedAt === 'number'
            ? options.updatedAt
            : null

    const memoryEntry = this.readMemoryEntry(key)
    if (memoryEntry) {
      if (minUpdatedAt !== null && new Date(memoryEntry.updatedAt).getTime() < minUpdatedAt) {
        await this.delete(key)
        return null
      }
      try {
        const parsed = JSON.parse(memoryEntry.payload) as CachedDerivedProductBundle<T>
        return parsed.value
      } catch {
        return null
      }
    }

    const redisEntry = await this.readRedisEntry(key)
    if (!redisEntry) {
      return null
    }
    if (minUpdatedAt !== null && new Date(redisEntry.updatedAt).getTime() < minUpdatedAt) {
      await this.delete(key)
      return null
    }

    try {
      const parsed = JSON.parse(redisEntry.payload) as CachedDerivedProductBundle<T>
      if (
        typeof parsed?.baseProductId !== 'number' ||
        typeof parsed?.updatedAt !== 'string' ||
        parsed.value === undefined
      ) {
        return null
      }
      this.setMemoryEntry(key, {
        payload: JSON.stringify(parsed),
        baseProductId: parsed.baseProductId,
        updatedAt: parsed.updatedAt,
        expiresAt: Date.now() + this.ttlMs,
      })
      return parsed.value
    } catch (error) {
      this.logger.warn(`Derived products cache payload parse failed for ${key}: ${(error as Error).message}`)
      return null
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: { baseProductId: number; priceVersion: string; updatedAt: Date | string | number },
  ): Promise<T> {
    const updatedAt =
      options.updatedAt instanceof Date
        ? options.updatedAt.toISOString()
        : typeof options.updatedAt === 'number'
          ? new Date(options.updatedAt).toISOString()
          : new Date(options.updatedAt).toISOString()
    const bundle: CachedDerivedProductBundle<T> = {
      baseProductId: options.baseProductId,
      priceVersion: options.priceVersion,
      updatedAt,
      value,
    }
    const payload = JSON.stringify(bundle)
    this.setMemoryEntry(key, {
      payload,
      baseProductId: options.baseProductId,
      updatedAt,
      expiresAt: Date.now() + this.ttlMs,
    })
    if (this.redis) {
      try {
        await this.redis.set(key, payload, 'PX', this.ttlMs)
      } catch (error) {
        this.logger.warn(`Derived products cache Redis write failed for ${key}: ${(error as Error).message}`)
      }
    }
    return JSON.parse(JSON.stringify(value)) as T
  }

  async delete(key: string) {
    this.memoryCache.delete(key)
    if (this.redis) {
      try {
        await this.redis.del(key)
      } catch (error) {
        this.logger.warn(`Derived products cache Redis delete failed for ${key}: ${(error as Error).message}`)
      }
    }
  }

  async invalidateBaseProduct(baseProductId: number) {
    const prefix = `derived_products:${baseProductId}:`
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key)
      }
    }
    if (!this.redis) {
      return
    }
    try {
      const keys = await this.redis.keys(`${prefix}*`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      this.logger.warn(`Derived products cache invalidation failed for base product ${baseProductId}: ${(error as Error).message}`)
    }
  }
}
