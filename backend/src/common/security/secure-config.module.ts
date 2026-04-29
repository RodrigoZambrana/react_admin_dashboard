import { Global, Module } from '@nestjs/common'
import { ConfigEncryptionService } from './config-encryption.service'
import { SecureConfigService } from './secure-config.service'
import { GoogleConfigService } from '../integrations/google-config.service'
import { GoogleAdsConfigService } from '../integrations/google-ads-config.service'

@Global()
@Module({
  providers: [
    ConfigEncryptionService,
    SecureConfigService,
    GoogleConfigService,
    GoogleAdsConfigService,
  ],
  exports: [
    ConfigEncryptionService,
    SecureConfigService,
    GoogleConfigService,
    GoogleAdsConfigService,
  ],
})
export class SecureConfigModule {}
