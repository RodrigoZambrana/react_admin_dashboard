import { Body, Controller, Get, Post, Put } from '@nestjs/common';

import { UpdateWhatsappQrChannelControlDto } from './dto/update-whatsapp-qr-channel-control.dto';
import { UpdateMetaChannelSettingsDto } from './dto/update-meta-channel-settings.dto';
import { UpdateEmailInboxSettingsDto } from './dto/update-email-inbox-settings.dto';
import { ChannelSettingsService } from './channel-settings.service';

@Controller('settings/channels')
export class ChannelSettingsController {
  constructor(
    private readonly channelSettingsService: ChannelSettingsService,
  ) {}

  @Get('meta')
  getMetaOverview() {
    return this.channelSettingsService.getMetaOverview();
  }

  @Put('meta')
  updateMetaConfig(@Body() body: UpdateMetaChannelSettingsDto) {
    return this.channelSettingsService.updateMetaConfig(body);
  }

  @Post('meta/sync')
  syncMetaConfig() {
    return this.channelSettingsService.syncMetaConfig();
  }

  @Get('whatsapp-qr')
  getWhatsappQrOverview() {
    return this.channelSettingsService.getWhatsappQrOverview();
  }

  @Put('whatsapp-qr')
  updateWhatsappQrConfig(@Body() body: UpdateWhatsappQrChannelControlDto) {
    return this.channelSettingsService.updateWhatsappQrConfig(body);
  }

  @Post('whatsapp-qr/session/start')
  startWhatsappQrSession() {
    return this.channelSettingsService.startWhatsappQrSession();
  }

  @Post('whatsapp-qr/session/stop')
  stopWhatsappQrSession() {
    return this.channelSettingsService.stopWhatsappQrSession();
  }

  @Post('whatsapp-qr/session/reconnect')
  reconnectWhatsappQrSession() {
    return this.channelSettingsService.reconnectWhatsappQrSession();
  }

  @Post('whatsapp-qr/session/reset')
  resetWhatsappQrSession() {
    return this.channelSettingsService.resetWhatsappQrSession();
  }

  @Post('whatsapp-qr/sync')
  syncWhatsappQrConfig() {
    return this.channelSettingsService.syncWhatsappQrConfig();
  }

  @Post('whatsapp-qr/backfill')
  backfillWhatsappQrHistory() {
    return this.channelSettingsService.backfillWhatsappQrHistory();
  }

  @Get('email')
  getEmailInboxConfig() {
    return this.channelSettingsService.getEmailInboxConfig();
  }

  @Put('email')
  updateEmailInboxConfig(@Body() body: UpdateEmailInboxSettingsDto) {
    return this.channelSettingsService.updateEmailInboxConfig(body);
  }
}
