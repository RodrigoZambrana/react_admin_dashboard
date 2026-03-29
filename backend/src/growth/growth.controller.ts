import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { UpdateGrowthConfigDto } from './dto/update-growth-config.dto'
import { GrowthService } from './growth.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
@Controller('settings/growth')
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  getOverview() {
    return this.growth.getOverview()
  }

  @Put()
  updateConfig(@Body() body: UpdateGrowthConfigDto) {
    return this.growth.updateConfig(body)
  }
}
