import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  NotificationAudience,
  NotificationChannel,
  NotificationDeliveryStatus,
  Prisma,
} from '@prisma/client'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationStreamService, NotificationBroadcast } from './notification-stream.service'

const QUEUE_NAME = 'notifications-dispatch'

type NotificationJobData = {
  notificationId: number
}

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name)
  private queue: Queue<NotificationJobData> | null = null
  private worker: Worker<NotificationJobData> | null = null
  private inlineMode = false
  private connection: Redis | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
  ) {}

  async onModuleInit() {
    const provider = (this.config.get<string>('NOTIFS_QUEUE_PROVIDER') ?? 'memory').toLowerCase()
    const connectionString =
      this.config.get<string>('NOTIFS_QUEUE_URL') ||
      this.config.get<string>('QUEUE_REDIS_URL') ||
      this.config.get<string>('REDIS_URL')

    if (provider === 'memory' || !connectionString) {
      this.inlineMode = true
      if (!connectionString) {
        this.logger.warn('No Redis connection string provided for notifications queue. Falling back to inline mode.')
      }
      return
    }

    this.connection = new Redis(connectionString, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    this.queue = new Queue<NotificationJobData>(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: Number(this.config.get<string>('NOTIFS_QUEUE_ATTEMPTS') ?? '3'),
        backoff: {
          type: 'exponential',
          delay: Number(this.config.get<string>('NOTIFS_QUEUE_RETRY_DELAY_MS') ?? '15000'),
        },
      },
    })

    this.worker = new Worker<NotificationJobData>(
      QUEUE_NAME,
      async (job) => {
        await this.dispatch(job.data.notificationId)
      },
      {
        connection: this.connection,
        concurrency: Number(this.config.get<string>('NOTIFS_QUEUE_CONCURRENCY') ?? '4'),
        autorun: true,
      },
    )

    this.worker.on('failed', (job, err) => {
      if (!job) return
      this.logger.error(`Notification job ${job.id} failed: ${err?.message}`)
    })
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
    }
    if (this.queue) {
      await this.queue.close()
    }
    if (this.connection) {
      try {
        await this.connection.quit()
      } catch (error) {
        this.logger.error(`Failed to close Redis connection: ${(error as Error).message}`)
      }
    }
  }

  async enqueue(notificationId: number) {
    if (this.inlineMode || !this.queue) {
      await this.dispatch(notificationId)
      return
    }
    const jobId = `notification:${notificationId}`
    await this.queue.add('deliver', { notificationId }, { jobId })
  }

  private async dispatch(notificationId: number) {
    const baseSelect = {
      id: true,
      eventType: true,
      audience: true,
      channel: true,
      deliveryStatus: true,
      title: true,
      body: true,
      metadata: true,
      readAt: true,
      readed: true,
      createdAt: true,
      updatedAt: true,
      orderId: true,
      paymentId: true,
      recipientId: true,
      customerId: true,
      recipient: {
        select: { id: true, email: true, name: true, lastName: true },
      },
      customer: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    } as const

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: baseSelect,
    })
    if (!notification) {
      this.logger.warn(`Notification ${notificationId} no longer exists.`)
      return
    }
    if (notification.deliveryStatus === NotificationDeliveryStatus.SENT) {
      return
    }
    if (notification.channel !== NotificationChannel.IN_APP) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { deliveryStatus: NotificationDeliveryStatus.SENT },
      })
      return
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: NotificationDeliveryStatus.SENT,
      },
      select: baseSelect,
    })

    const event: NotificationBroadcast = {
      notification: {
        id: updated.id,
        eventType: updated.eventType ?? null,
        audience: updated.audience ?? null,
        channel: updated.channel,
        deliveryStatus: updated.deliveryStatus,
        title: updated.title ?? null,
        body: updated.body ?? null,
        metadata: this.deserializeMetadata(updated.metadata),
        readAt: updated.readAt,
        readed: updated.readed,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        orderId: updated.orderId ?? null,
        paymentId: updated.paymentId ?? null,
        customer: updated.customer
          ? {
              id: updated.customer.id,
              firstName: updated.customer.firstName,
              lastName: updated.customer.lastName,
              email: updated.customer.email ?? '',
            }
          : null,
        recipient: updated.recipient
          ? {
              id: updated.recipient.id,
              name: updated.recipient.name,
              lastName: updated.recipient.lastName,
              email: updated.recipient.email,
            }
          : null,
      },
      audience: updated.audience ?? NotificationAudience.ADMIN,
      userId: updated.recipientId ?? null,
      customerId: updated.customerId ?? null,
    }
    this.stream.emit(event)
  }

  private deserializeMetadata(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
    if (metadata === null || metadata === undefined) {
      return null
    }
    if (typeof metadata === 'object') {
      return metadata as Record<string, unknown>
    }
    try {
      return JSON.parse(String(metadata)) as Record<string, unknown>
    } catch (error) {
      this.logger.warn(`Failed to parse notification metadata in queue: ${(error as Error).message}`)
      return null
    }
  }
}
