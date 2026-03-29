import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { SecureConfigModule } from '../../common/security/secure-config.module'
import { MetaChannelController } from './meta.controller'
import { MetaChannelService } from './meta.service'

@Module({
  imports: [ConfigModule, PrismaModule, SecureConfigModule],
  controllers: [MetaChannelController],
  providers: [MetaChannelService],
  exports: [MetaChannelService],
})
export class MetaChannelModule {}
