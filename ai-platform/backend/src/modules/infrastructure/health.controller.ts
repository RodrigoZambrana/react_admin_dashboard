import { Controller, Get } from '@nestjs/common';

import { InfrastructureService } from './infrastructure.service';

@Controller('health')
export class HealthController {
  constructor(private readonly infrastructureService: InfrastructureService) {}

  @Get()
  health() {
    return {
      service: 'ai-conversational-platform',
      status: 'ok',
    };
  }

  @Get('ready')
  readiness() {
    return this.infrastructureService.getReadiness();
  }
}
