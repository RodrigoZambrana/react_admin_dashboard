import { Module } from '@nestjs/common';

import { PipelineLoggerService } from './pipeline-logger.service';

@Module({
  providers: [PipelineLoggerService],
  exports: [PipelineLoggerService],
})
export class LoggingModule {}
