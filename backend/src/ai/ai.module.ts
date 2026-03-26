import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { PrismaModule } from '../prisma/prisma.module'
import { KnowledgeModule } from '../knowledge/knowledge.module'
import { OrdersModule } from '../orders/orders.module'
import { AberturasGlossaryModule } from '../aberturas/aberturas-glossary.module'
import { PricingModule } from '../pricing/pricing.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SecureConfigModule,
    KnowledgeModule,
    OrdersModule,
    AberturasGlossaryModule,
    PricingModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
