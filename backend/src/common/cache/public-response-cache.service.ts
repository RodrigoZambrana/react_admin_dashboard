import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cloneValue = <T>(value: T): T => {
  const structuredCloneFn = (globalThis as { structuredClone?: <U>(input: U) => U }).structuredClone
  if (typeof structuredCloneFn === 'function') {
    return structuredCloneFn(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

@Injectable()
export class PublicResponseCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicResponseCacheService.name)
  private readonly memoryCache = new Map<string, CacheEntry<unknown>>()
  private readonly maxEntries: number
  private redis: Redis | null = null

  constructor(private readonly config: ConfigService) {
    this.maxEntries = Number(this.config.get<string>('PUBLIC_CACHE_MAX_ENTRIES') ?? '500')
  }

  async onModuleInit() {
    const disabled = (this.config.get<string>('PUBLIC_CACHE_DISABLED') ?? 'false').toLowerCase() === 'true'
    const connectionString =
      this.config.get<string>('PUBLIC_CACHE_REDIS_URL') ||
      this.config.get<string>('REDIS_URL') ||
      this.config.get<string>('QUEUE_REDIS_URL')

    if (disabled || !connectionString) {
      if (!connectionString) {
        this.logger.warn('No Redis connection string provided for public cache. Using in-memory cache only.')
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
      this.logger.warn(`Failed to close public cache Redis connection: ${(error as Error).message}`)
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

  private setMemoryEntry<T>(key: string, value: T, ttlMs: number) {
    this.memoryCache.set(key, {
      value: cloneValue(value),
      expiresAt: Date.now() + ttlMs,
    })
    this.touchMemoryEntry(key)
    while (this.memoryCache.size > this.maxEntries) {
      const oldestKey = this.memoryCache.keys().next().value as string | undefined
      if (!oldestKey) {
        break
      }
      this.memoryCache.delete(oldestKey)
    }
  }

  private readMemoryEntry<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key)
      return null
    }
    this.touchMemoryEntry(key)
    return cloneValue(entry.value as T)
  }

  private async readRedisEntry<T>(key: string): Promise<T | null> {
    if (!this.redis) {
      return null
    }
    try {
      const payload = await this.redis.get(key)
      if (!payload) {
        return null
      }
      const parsed = JSON.parse(payload) as CacheEntry<T>
      if (!parsed || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
        await this.redis.del(key)
        return null
      }
      return cloneValue(parsed.value)
    } catch (error) {
      this.logger.warn(`Public cache Redis read failed for ${key}: ${(error as Error).message}`)
      return null
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const memoryHit = this.readMemoryEntry<T>(key)
    if (memoryHit !== null) {
      this.logger.debug(`Public cache hit: ${key} (memory)`)
      return memoryHit
    }

    const redisHit = await this.readRedisEntry<T>(key)
    if (redisHit !== null) {
      this.logger.debug(`Public cache hit: ${key} (redis)`)
      return redisHit
    }

    this.logger.debug(`Public cache miss: ${key}`)
    return null
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<T> {
    const cloned = cloneValue(value)
    this.setMemoryEntry(key, cloned, ttlMs)
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify({ value: cloned, expiresAt: Date.now() + ttlMs }), 'PX', ttlMs)
      } catch (error) {
        this.logger.warn(`Public cache Redis write failed for ${key}: ${(error as Error).message}`)
      }
    }
    return cloneValue(cloned)
  }

  async invalidate(prefixOrKey?: string) {
    if (!prefixOrKey) {
      this.memoryCache.clear()
      if (this.redis) {
        try {
          const keys = await this.redis.keys('*')
          if (keys.length > 0) {
            await this.redis.del(...keys)
          }
        } catch (error) {
          this.logger.warn(`Public cache Redis clear failed: ${(error as Error).message}`)
        }
      }
      return
    }

    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(prefixOrKey)) {
        this.memoryCache.delete(key)
      }
    }

    if (!this.redis) {
      return
    }

    try {
      const keys = await this.redis.keys(`${prefixOrKey}*`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      this.logger.warn(`Public cache Redis invalidation failed for ${prefixOrKey}: ${(error as Error).message}`)
    }
  }
}
