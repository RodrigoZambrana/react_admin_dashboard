import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailLogStatus, Prisma, EmailLog } from '@prisma/client'
import { Queue, Worker, JobsOptions } from 'bullmq'
import Redis from 'ioredis'
import { randomUUID, createHash } from 'crypto'
import { EmailMessage, EmailProviderSendResult } from '../email.types'
import { EmailProviderFactory } from '../email-provider.factory'
import { PrismaService } from '../../prisma/prisma.service'

type EmailJobData = {
  logId: number
  message: EmailMessage
}

type MetricsCounters = {
  attempts: number
  sent: number
  failed: number
}

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name)
  private readonly queueName = 'email-dispatch'
  private queue: Queue<EmailJobData> | null = null
  private worker: Worker<EmailJobData> | null = null
  private inlineMode = false
  private jobOptions: JobsOptions
  private redisConnection: Redis | null = null
  private readonly dedupeWindowMs: number
  private readonly metrics = {
    totals: { attempts: 0, sent: 0, failed: 0 },
    perCategory: new Map<string, MetricsCounters>(),
    perTemplate: new Map<string, MetricsCounters>(),
  }

  constructor(
    private readonly config: ConfigService,
    private readonly providerFactory: EmailProviderFactory,
    private readonly prisma: PrismaService,
  ) {
    const attempts = Number(this.config.get<string>('EMAIL_MAX_RETRIES') ?? '3')
    const backoffDelay = Number(this.config.get<string>('EMAIL_RETRY_DELAY_MS') ?? '30000')
    this.jobOptions = {
      attempts: attempts > 0 ? attempts : 3,
      removeOnComplete: true,
      removeOnFail: false,
      backoff: {
        type: 'exponential',
        delay: backoffDelay,
      },
    }
    this.dedupeWindowMs = Number(this.config.get<string>('EMAIL_DEDUPE_WINDOW_MS') ?? '300000')
  }

  async onModuleInit() {
    const queueDisabled = (this.config.get<string>('EMAIL_QUEUE_DISABLED') ?? 'false').toLowerCase() === 'true'
    const connectionString =
      this.config.get<string>('EMAIL_QUEUE_URL') ||
      this.config.get<string>('QUEUE_REDIS_URL') ||
      this.config.get<string>('REDIS_URL')

    if (queueDisabled || !connectionString) {
      this.inlineMode = true
      if (!connectionString) {
        this.logger.warn('No Redis connection string provided. Email queue will run inline.')
      } else {
        this.logger.warn('Email queue disabled via EMAIL_QUEUE_DISABLED. Messages will be sent inline.')
      }
      return
    }

    this.redisConnection = new Redis(connectionString, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    this.queue = new Queue<EmailJobData>(this.queueName, {
      connection: this.redisConnection,
      defaultJobOptions: this.jobOptions,
    })

    this.worker = new Worker<EmailJobData>(
      this.queueName,
      async (job) => {
        await this.handleJob(job.data.logId, job.data.message, job.attemptsMade, job.opts.attempts ?? this.jobOptions.attempts ?? 3)
      },
      {
        connection: this.redisConnection,
        concurrency: Number(this.config.get<string>('EMAIL_QUEUE_CONCURRENCY') ?? '4'),
        autorun: true,
      },
    )

    this.worker.on('failed', (job, err) => {
      if (!job) return
      this.logger.error(`Email job ${job.id} failed after ${job.attemptsMade} attempts: ${err?.message}`)
    })

    this.worker.on('completed', (job) => {
      this.logger.log(`Email job ${job.id} completed.`)
    })
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
    }
    if (this.queue) {
      await this.queue.close()
    }
    if (this.redisConnection) {
      try {
        await this.redisConnection.quit()
      } catch (error) {
        this.logger.error(`Failed to close Redis connection: ${(error as Error).message}`)
      } finally {
        this.redisConnection = null
      }
    }
  }

  private hashPayload(payload: Prisma.InputJsonValue) {
    const json = JSON.stringify(payload)
    return createHash('sha256').update(json).digest('hex')
  }

  private sanitizePayload(payload: Record<string, unknown>): Prisma.InputJsonValue {
    const serialized = JSON.stringify(payload, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString()
      }
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    })
    return JSON.parse(serialized) as Prisma.InputJsonValue
  }

  private async createLog(message: EmailMessage): Promise<{ log: EmailLog; skipped: boolean }> {
    if (!message.recipients.length) {
      throw new Error('Email message requires at least one recipient')
    }
    const payload = this.sanitizePayload(message.payload)
    const payloadHash = this.hashPayload(payload)
    const primaryRecipient = message.recipients[0]
    const duplicate = await this.findDuplicateLog(
      message.category,
      message.recipientType,
      primaryRecipient.email,
      payloadHash,
    )
    if (duplicate) {
      this.logger.debug(
        `Duplicate email suppressed for ${primaryRecipient.email} [${message.category}/${message.variant}]`,
      )
      return { log: duplicate, skipped: true }
    }
    const log = await this.prisma.emailLog.create({
      data: {
        category: message.category,
        templateId: message.templateId ?? null,
        locale: message.locale,
        recipientType: message.recipientType,
        toAddress: primaryRecipient.email,
        ccAddresses: message.cc ?? [],
        bccAddresses: message.bcc ?? [],
        subject: message.subject,
        payload,
        payloadHash,
        status: EmailLogStatus.QUEUED,
        attempts: 0,
      },
    })
    return { log, skipped: false }
  }

  private async findDuplicateLog(
    category: EmailMessage['category'],
    recipientType: EmailMessage['recipientType'],
    email: string,
    payloadHash: string,
  ) {
    const since = new Date(Date.now() - this.dedupeWindowMs)
    return this.prisma.emailLog.findFirst({
      where: {
        category,
        recipientType,
        toAddress: email,
        payloadHash,
        status: { in: [EmailLogStatus.QUEUED, EmailLogStatus.SENT, EmailLogStatus.RETRYING] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async enqueue(message: EmailMessage) {
    const { log, skipped } = await this.createLog(message)
    if (skipped) {
      return log
    }
    if (this.inlineMode || !this.queue) {
      await this.sendInline(log.id, message)
      return log
    }
    const jobId = randomUUID()
    await this.queue.add('send-email', { logId: log.id, message }, { jobId })
    return log
  }

  private async sendInline(logId: number, message: EmailMessage) {
    try {
      await this.updateLogAttempt(logId, 1, EmailLogStatus.RETRYING, message)
      const result = await this.dispatch(message)
      await this.markSuccess(logId, result, message)
    } catch (error) {
      await this.markFailure(logId, error as Error, 1, 1, message)
      throw error
    }
  }

  private async handleJob(logId: number, message: EmailMessage, attemptsMade: number, maxAttempts: number) {
    try {
      await this.updateLogAttempt(logId, attemptsMade + 1, EmailLogStatus.RETRYING, message)
      const result = await this.dispatch(message)
      await this.markSuccess(logId, result, message)
    } catch (error) {
      const attempt = attemptsMade + 1
      await this.markFailure(logId, error as Error, attempt, maxAttempts, message)
      if (attempt >= maxAttempts) {
        throw error
      }
      throw error
    }
  }

  private async updateLogAttempt(
    logId: number,
    attempt: number,
    status: EmailLogStatus,
    message: EmailMessage,
  ) {
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        attempts: attempt,
        status,
        lastAttemptAt: new Date(),
      },
    })
    this.recordAttempt(message)
  }

  private async markSuccess(logId: number, result: EmailProviderSendResult, message: EmailMessage) {
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: EmailLogStatus.SENT,
        providerMessageId: result.messageId ?? null,
        lastAttemptAt: new Date(),
      },
    })
    this.recordMetric('sent', message)
  }

  private async markFailure(
    logId: number,
    error: Error,
    attempt: number,
    maxAttempts: number,
    message: EmailMessage,
  ) {
    const status = attempt >= maxAttempts ? EmailLogStatus.FAILED : EmailLogStatus.RETRYING
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        status,
        attempts: attempt,
        errorMessage: error.message?.slice(0, 1024) ?? 'Unknown error',
        lastAttemptAt: new Date(),
      },
    })
    if (status === EmailLogStatus.FAILED) {
      this.recordMetric('failed', message)
    }
  }

  getMetricsSnapshot() {
    const perCategory: Record<string, MetricsCounters> = {}
    const perTemplate: Record<string, MetricsCounters> = {}
    for (const [key, value] of this.metrics.perCategory.entries()) {
      perCategory[key] = { ...value }
    }
    for (const [key, value] of this.metrics.perTemplate.entries()) {
      perTemplate[key] = { ...value }
    }
    return {
      totals: { ...this.metrics.totals },
      perCategory,
      perTemplate,
    }
  }

  private recordAttempt(message: EmailMessage) {
    this.metrics.totals.attempts += 1
    this.incrementMetricBucket(this.metrics.perCategory, message.category, 'attempts')
    this.incrementMetricBucket(this.metrics.perTemplate, this.buildTemplateKey(message), 'attempts')
  }

  private recordMetric(outcome: 'sent' | 'failed', message: EmailMessage) {
    this.metrics.totals[outcome] += 1
    this.incrementMetricBucket(this.metrics.perCategory, message.category, outcome)
    this.incrementMetricBucket(this.metrics.perTemplate, this.buildTemplateKey(message), outcome)
  }

  private incrementMetricBucket(map: Map<string, MetricsCounters>, key: string, field: keyof MetricsCounters) {
    const entry = map.get(key) ?? { attempts: 0, sent: 0, failed: 0 }
    entry[field] += 1
    map.set(key, entry)
  }

  private buildTemplateKey(message: EmailMessage) {
    const templateId = message.templateId ?? 'custom'
    return `${message.category}:${message.variant}:${templateId}`
  }

  private async dispatch(message: EmailMessage): Promise<EmailProviderSendResult> {
    const provider = await this.providerFactory.getProvider()
    return provider.send(message)
  }
}
