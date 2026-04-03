import { Module } from '@nestjs/common';

import { MemoryModule } from '../memory/memory.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { InfrastructureService } from './infrastructure.service';
import { HealthController } from './health.controller';

@Module({
  imports: [MemoryModule, KnowledgeModule],
  controllers: [HealthController],
  providers: [InfrastructureService],
  exports: [InfrastructureService],
})
export class InfrastructureModule {}
