import { Global, Module } from '@nestjs/common';

import { ConfigEncryptionService } from './config-encryption.service';
import { SecureConfigService } from './secure-config.service';
import { SecurityPreparationService } from './security-preparation.service';

@Global()
@Module({
  providers: [
    ConfigEncryptionService,
    SecureConfigService,
    SecurityPreparationService,
  ],
  exports: [
    ConfigEncryptionService,
    SecureConfigService,
    SecurityPreparationService,
  ],
})
export class SecurityModule {}
