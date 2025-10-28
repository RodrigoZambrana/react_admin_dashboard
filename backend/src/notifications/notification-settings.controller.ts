import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { NotificationSettingsService } from './notification-settings.service'
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  async list() {
    return this.settings.listSettings()
  }

  @Put()
  async update(@Body() body: UpdateNotificationSettingsDto) {
    const normalized = {
      settings: (body.settings ?? []).map((setting) => ({
        ...setting,
        roles: setting.roles ?? [],
      })),
    }
    return this.settings.updateSettings(normalized)
  }
}
