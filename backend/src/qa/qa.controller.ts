import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { ROLES } from '../auth/roles.decorator'
import { QaResultsService } from './qa-results.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
@Controller('qa')
export class QaController {
  constructor(private readonly qaResults: QaResultsService) {}

  @Get('catalog')
  catalog() {
    return this.qaResults.listCatalog()
  }

  @Get('runs/latest')
  latest() {
    return this.qaResults.getLatestRun()
  }

  @Get('runs')
  list(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit)
    return this.qaResults.listRuns(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10)
  }

  @Get('runs/:id')
  async details(@Param('id') id: string) {
    const run = await this.qaResults.getRun(id)
    if (!run) {
      throw new NotFoundException('qa.run.notFound')
    }
    return run
  }
}
