import { Global, Module } from '@nestjs/common'
import { ClientConfigProvider } from './client-config.provider'

@Global()
@Module({
  providers: [ClientConfigProvider],
  exports: [ClientConfigProvider],
})
export class ClientConfigModule {}
