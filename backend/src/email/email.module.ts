import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { EmailService } from './email.service'
import { EmailTemplateService } from './email-template.service'
import { EmailQueueService } from './queue/email-queue.service'
import { EmailSettingsService } from './email-settings.service'
import { EmailProviderFactory } from './email-provider.factory'
import { EmailLogService } from './email-log.service'
import { EmailAdminController } from './email-admin.controller'
import { EmailController } from './email.controller'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { InboxModule } from '../inbox/inbox.module'

@Module({
  imports: [ConfigModule, PrismaModule, SecureConfigModule, InboxModule],
  controllers: [EmailAdminController, EmailController],
  providers: [
    EmailService,
    EmailTemplateService,
    EmailQueueService,
    EmailSettingsService,
    EmailProviderFactory,
    EmailLogService,
  ],
  exports: [EmailService, EmailSettingsService, EmailTemplateService, EmailLogService],
})
export class EmailModule {}
