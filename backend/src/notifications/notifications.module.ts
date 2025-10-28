import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { EmailModule } from '../email/email.module'
import { NotificationsController } from './notifications.controller'
import { NotificationSettingsController } from './notification-settings.controller'
import { StorefrontNotificationsController } from './storefront-notifications.controller'
import { NotificationsService } from './notifications.service'
import { NotificationSettingsService } from './notification-settings.service'
import { NotificationQueueService } from './notification-queue.service'
import { NotificationStreamService } from './notification-stream.service'
import { NotificationOrchestratorService } from './notification-orchestrator.service'

@Module({
  imports: [ConfigModule, PrismaModule, EmailModule],
  controllers: [NotificationsController, NotificationSettingsController, StorefrontNotificationsController],
  providers: [
    NotificationsService,
    NotificationSettingsService,
    NotificationQueueService,
    NotificationStreamService,
    NotificationOrchestratorService,
  ],
  exports: [
    NotificationsService,
    NotificationSettingsService,
    NotificationQueueService,
    NotificationStreamService,
    NotificationOrchestratorService,
  ],
})
export class NotificationsModule {}
