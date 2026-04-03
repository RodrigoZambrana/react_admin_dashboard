import { Module } from '@nestjs/common';

import { TemporalExpressionService } from './temporal-expression.service';
import { FileSystemTemporalLocaleProvider } from './filesystem-temporal-locale.provider';
import { TemporalLocaleProvider } from './temporal-locale.provider';

@Module({
  providers: [
    FileSystemTemporalLocaleProvider,
    {
      provide: TemporalLocaleProvider,
      useExisting: FileSystemTemporalLocaleProvider,
    },
    TemporalExpressionService,
  ],
  exports: [TemporalLocaleProvider, TemporalExpressionService],
})
export class TemporalModule {}
