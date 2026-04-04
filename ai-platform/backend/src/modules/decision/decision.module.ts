import { Module } from '@nestjs/common';

import { ToolsModule } from '../tools/tools.module';
import { DecisionService } from './decision.service';

@Module({
  imports: [ToolsModule],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
