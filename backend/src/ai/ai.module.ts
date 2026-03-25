import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [ConfigModule, PrismaModule, SecureConfigModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
