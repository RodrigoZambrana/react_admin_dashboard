import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecureConfigModule } from '../security/secure-config.module'
import { OpenAiClientService } from './openai-client.service'

@Module({
  imports: [ConfigModule, SecureConfigModule],
  providers: [OpenAiClientService],
  exports: [OpenAiClientService],
})
export class OpenAiClientModule {}
