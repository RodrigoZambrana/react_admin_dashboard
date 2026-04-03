import { Global, Module } from '@nestjs/common';

import { PipelineLoggerService } from './pipeline-logger.service';

@Global()
@Module({
  providers: [PipelineLoggerService],
  exports: [PipelineLoggerService],
})
export class LoggingModule {}
