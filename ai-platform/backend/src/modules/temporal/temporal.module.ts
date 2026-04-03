import { Module } from '@nestjs/common';

import { TemporalExpressionService } from './temporal-expression.service';
import { TemporalLocaleRegistryService } from './temporal-locale-registry.service';

@Module({
  providers: [TemporalLocaleRegistryService, TemporalExpressionService],
  exports: [TemporalLocaleRegistryService, TemporalExpressionService],
})
export class TemporalModule {}
