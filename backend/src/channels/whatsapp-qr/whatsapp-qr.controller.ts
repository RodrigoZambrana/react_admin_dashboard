import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/roles.guard'
import { Roles, ROLES } from '../../auth/roles.decorator'
import { WhatsappQrService } from './whatsapp-qr.service'
import { UpdateWhatsappQrConfigDto } from './dto/update-whatsapp-qr-config.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
@Controller('settings/channels/whatsapp-qr')
export class WhatsappQrController {
  constructor(private readonly whatsappQr: WhatsappQrService) {}

  @Get()
  getOverview() {
    return this.whatsappQr.getOverview()
  }

  @Put()
  updateConfig(@Body() body: UpdateWhatsappQrConfigDto) {
    return this.whatsappQr.updateConfig(body)
  }

  @Post('session/start')
  startSession() {
    return this.whatsappQr.startSession()
  }

  @Post('session/stop')
  stopSession() {
    return this.whatsappQr.stopSession()
  }

  @Post('session/reconnect')
  reconnectSession() {
    return this.whatsappQr.reconnectSession()
  }

  @Post('session/reset')
  resetSession() {
    return this.whatsappQr.resetSession()
  }

  @Post('sync')
  syncConfigToAdapter() {
    return this.whatsappQr.syncConfigToAdapter()
  }

  @Post('backfill')
  backfillHistory() {
    return this.whatsappQr.backfillHistory()
  }
}
