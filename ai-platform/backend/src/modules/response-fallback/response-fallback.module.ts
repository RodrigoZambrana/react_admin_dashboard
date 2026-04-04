import { Module } from '@nestjs/common';

import { ResponseFallbackVersionRepository } from '../persistence/repositories/response-fallback-version.repository';
import { FileSystemResponseFallbackSeedSource } from './filesystem-response-fallback.seed-source';
import { ManagedResponseFallbackProvider } from './managed-response-fallback.provider';
import { ResponseFallbackProvider } from './response-fallback.provider';
import { ResponseFallbackService } from './response-fallback.service';

@Module({
  providers: [
    FileSystemResponseFallbackSeedSource,
    ManagedResponseFallbackProvider,
    ResponseFallbackVersionRepository,
    ResponseFallbackService,
    {
      provide: ResponseFallbackProvider,
      useExisting: ManagedResponseFallbackProvider,
    },
  ],
  exports: [ResponseFallbackProvider, ResponseFallbackService],
})
export class ResponseFallbackModule {}
