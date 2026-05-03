import { Module } from '@nestjs/common'

import { AnalyticsModule } from '../analytics/analytics.module'
import { GrowthModule } from '../growth/growth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ConversionsController } from './conversions.controller'
import { ConversionsService } from './conversions.service'

@Module({
  imports: [PrismaModule, AnalyticsModule, GrowthModule],
  controllers: [ConversionsController],
  providers: [ConversionsService],
  exports: [ConversionsService],
})
export class ConversionsModule {}

