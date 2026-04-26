import { Global, Module } from '@nestjs/common';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { CriticalConfigModule } from '../critical-config/critical-config.module';
import { SecurityModule } from '../security/security.module';
import { AiRuntimeDiagnosticsService } from './ai-runtime-diagnostics.service';
import { RuntimeConfigService } from './runtime-config.service';

@Global()
@Module({
  imports: [CriticalConfigModule, AiGatewayModule, SecurityModule],
  providers: [RuntimeConfigService, AiRuntimeDiagnosticsService],
  exports: [RuntimeConfigService, AiRuntimeDiagnosticsService],
})
export class RuntimeConfigModule {}
