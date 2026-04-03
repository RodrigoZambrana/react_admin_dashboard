import { Module } from '@nestjs/common';

import { TemporalExpressionService } from './temporal-expression.service';
import { ManagedTemporalLocaleProvider } from './managed-temporal-locale.provider';
import { FileSystemTemporalLocaleSeedSource } from './filesystem-temporal-locale.seed-source';
import { TemporalLocaleProvider } from './temporal-locale.provider';

@Module({
  providers: [
    FileSystemTemporalLocaleSeedSource,
    ManagedTemporalLocaleProvider,
    {
      provide: TemporalLocaleProvider,
      useExisting: ManagedTemporalLocaleProvider,
    },
    TemporalExpressionService,
  ],
  exports: [TemporalLocaleProvider, TemporalExpressionService],
})
export class TemporalModule {}
