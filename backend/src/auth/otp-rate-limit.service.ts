import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { DEFAULT_OTP_10M_LIMIT, DEFAULT_OTP_DAILY_LIMIT, DEFAULT_OTP_WINDOW_MS } from './otp/otp.constants'

@Injectable()
export class OtpRateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OtpRateLimitService.name)
  private redis: Redis | null = null
  private readonly memory = new Map<string, { count: number; expiresAt: number }>()

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const connectionString =
      this.config.get<string>('AUTH_REDIS_URL') ||
      this.config.get<string>('QUEUE_REDIS_URL') ||
      this.config.get<string>('REDIS_URL')

    if (!connectionString) {
      this.logger.warn('No Redis URL configured for auth rate limiting. Falling back to in-memory counters.')
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
      this.logger.error(`Failed to close auth Redis connection: ${(error as Error).message}`)
    } finally {
      this.redis = null
    }
  }

  private async incrementWithExpiry(key: string, ttlMs: number): Promise<number> {
    if (this.redis) {
      const current = await this.redis.incr(key)
      if (current === 1) {
        await this.redis.pexpire(key, ttlMs)
      }
      return current
    }

    const now = Date.now()
    const entry = this.memory.get(key)
    if (!entry || entry.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + ttlMs })
      return 1
    }
    entry.count += 1
    return entry.count
  }

  private async getCount(key: string): Promise<number> {
    if (this.redis) {
      const value = await this.redis.get(key)
      return value ? Number(value) : 0
    }

    const entry = this.memory.get(key)
    if (!entry || entry.expiresAt <= Date.now()) {
      return 0
    }
    return entry.count
  }

  async assertAllowed(target: {
    identifierKey: string
    subjectKey: string
    windowMs?: number
    perWindowLimit?: number
    dailyLimit?: number
  }) {
    const windowMs = target.windowMs ?? DEFAULT_OTP_WINDOW_MS
    const perWindowLimit = target.perWindowLimit ?? DEFAULT_OTP_10M_LIMIT
    const dailyLimit = target.dailyLimit ?? DEFAULT_OTP_DAILY_LIMIT

    const shortWindowKey = `auth:otp:${target.identifierKey}:window`
    const dailyKey = `auth:otp:${target.subjectKey}:daily`

    const windowCount = await this.incrementWithExpiry(shortWindowKey, windowMs)
    if (windowCount > perWindowLimit) {
      throw new Error('auth.rateLimit.otpWindow')
    }

    const dailyCount = await this.incrementWithExpiry(dailyKey, 24 * 60 * 60 * 1000)
    if (dailyCount > dailyLimit) {
      throw new Error('auth.rateLimit.otpDaily')
    }
  }

  async getWindowCount(identifierKey: string): Promise<number> {
    return this.getCount(`auth:otp:${identifierKey}:window`)
  }
}
