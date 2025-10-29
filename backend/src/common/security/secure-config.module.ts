import { Global, Module } from '@nestjs/common'
import { ConfigEncryptionService } from './config-encryption.service'
import { SecureConfigService } from './secure-config.service'
import { GoogleConfigService } from '../integrations/google-config.service'

@Global()
@Module({
  providers: [ConfigEncryptionService, SecureConfigService, GoogleConfigService],
  exports: [ConfigEncryptionService, SecureConfigService, GoogleConfigService],
})
export class SecureConfigModule {}
