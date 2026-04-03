import { Module } from '@nestjs/common';

import { TemporalExpressionService } from './temporal-expression.service';
import { ManagedTemporalLocaleProvider } from './managed-temporal-locale.provider';
import { FileSystemTemporalLocaleSeedSource } from './filesystem-temporal-locale.seed-source';
import { TemporalLocaleProvider } from './temporal-locale.provider';
import { TemporalLocaleService } from './temporal-locale.service';

@Module({
  providers: [
    FileSystemTemporalLocaleSeedSource,
    ManagedTemporalLocaleProvider,
    {
      provide: TemporalLocaleProvider,
      useExisting: ManagedTemporalLocaleProvider,
    },
    TemporalExpressionService,
    TemporalLocaleService,
  ],
  exports: [TemporalLocaleProvider, TemporalExpressionService, TemporalLocaleService],
})
export class TemporalModule {}
