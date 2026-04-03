import { Module } from '@nestjs/common';

import { SecurityPreparationService } from './security-preparation.service';

@Module({
  providers: [SecurityPreparationService],
  exports: [SecurityPreparationService],
})
export class SecurityModule {}
