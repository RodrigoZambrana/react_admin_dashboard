import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/roles.guard'
import { Roles, ROLES } from '../../auth/roles.decorator'
import { UpdateMetaChannelConfigDto } from './dto/update-meta-channel-config.dto'
import { MetaChannelService } from './meta.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
@Controller('settings/channels/meta')
export class MetaChannelController {
  constructor(private readonly metaChannel: MetaChannelService) {}

  @Get()
  getOverview() {
    return this.metaChannel.getOverview()
  }

  @Put()
  updateConfig(@Body() body: UpdateMetaChannelConfigDto) {
    return this.metaChannel.updateConfig(body)
  }

  @Post('sync')
  syncConfigToAdapter() {
    return this.metaChannel.syncConfigToAdapter()
  }
}
