import { Body, Controller, Get, Put } from '@nestjs/common';

import { ChannelControlService } from './channel-control.service';
import type {
  EmailChannelControl,
  MetaChannelControl,
  SharedRoutingControl,
  WebchatChannelControl,
  WhatsappQrChannelControl,
} from './channel-control.types';
import { UpdateEmailChannelControlDto } from './dto/update-email-channel-control.dto';
import { UpdateMetaChannelControlDto } from './dto/update-meta-channel-control.dto';
import { UpdateSharedRoutingControlDto } from './dto/update-shared-routing-control.dto';
import { UpdateWebchatChannelControlDto } from './dto/update-webchat-channel-control.dto';
import { UpdateWhatsappQrChannelControlDto } from './dto/update-whatsapp-qr-channel-control.dto';

@Controller('admin/channel-control')
export class ChannelControlController {
  constructor(private readonly channelControlService: ChannelControlService) {}

  @Get()
  getOverview() {
    return this.channelControlService.getOverview();
  }

  @Put('meta')
  updateMeta(@Body() body: UpdateMetaChannelControlDto) {
    return this.channelControlService.updateMeta(
      body as unknown as Partial<MetaChannelControl>,
      'admin:channel-control',
    );
  }

  @Put('whatsapp-qr')
  updateWhatsappQr(@Body() body: UpdateWhatsappQrChannelControlDto) {
    return this.channelControlService.updateWhatsappQr(
      body as unknown as Partial<WhatsappQrChannelControl>,
      'admin:channel-control',
    );
  }

  @Put('email')
  updateEmail(@Body() body: UpdateEmailChannelControlDto) {
    return this.channelControlService.updateEmail(
      body as unknown as Partial<EmailChannelControl>,
      'admin:channel-control',
    );
  }

  @Put('webchat')
  updateWebchat(@Body() body: UpdateWebchatChannelControlDto) {
    return this.channelControlService.updateWebchat(
      body as unknown as Partial<WebchatChannelControl>,
      'admin:channel-control',
    );
  }

  @Put('routing')
  updateRouting(@Body() body: UpdateSharedRoutingControlDto) {
    return this.channelControlService.updateRouting(
      body as unknown as Partial<SharedRoutingControl>,
      'admin:channel-control',
    );
  }
}
