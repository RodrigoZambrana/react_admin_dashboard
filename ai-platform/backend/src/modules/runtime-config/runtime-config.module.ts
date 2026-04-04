import { Global, Module } from '@nestjs/common';

import { CriticalConfigModule } from '../critical-config/critical-config.module';
import { RuntimeConfigService } from './runtime-config.service';

@Global()
@Module({
  imports: [CriticalConfigModule],
  providers: [RuntimeConfigService],
  exports: [RuntimeConfigService],
})
export class RuntimeConfigModule {}
