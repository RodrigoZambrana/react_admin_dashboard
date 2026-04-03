import { Module } from '@nestjs/common';

import { TemporalLocaleRegistryService } from './temporal-locale-registry.service';

@Module({
  providers: [TemporalLocaleRegistryService],
  exports: [TemporalLocaleRegistryService],
})
export class TemporalModule {}
