import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { GrowthController } from './growth.controller'
import { GrowthService } from './growth.service'

@Module({
  imports: [ConfigModule, SecureConfigModule],
  controllers: [GrowthController],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
