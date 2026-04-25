import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UpdateChannelConnectionStateDto } from './dto/update-channel-connection-state.dto';
import { ChannelControlService } from './channel-control.service';

@Controller('internal/channel-control')
export class ChannelControlInternalController {
  constructor(
    private readonly channelControlService: ChannelControlService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getOverview(@Headers('x-ai-internal-token') token?: string) {
    this.assertInternalToken(token);
    return this.channelControlService.getAdapterOverview();
  }

  @Get('channels/:channelKey')
  async getChannelSnapshot(
    @Param('channelKey') channelKey: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.channelControlService.getAdapterChannelSnapshot(channelKey);
  }

  @Put('channels/:channelKey/connection-state')
  async updateConnectionState(
    @Param('channelKey') channelKey: string,
    @Body() body: UpdateChannelConnectionStateDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.channelControlService.upsertConnectionState(
      channelKey,
      {
        driver: body.driver,
        enabled: body.enabled,
        connectionState: body.connectionState,
        health: body.health,
        summary: body.summary ?? null,
        capabilities: body.capabilities ?? {},
        payload: body.payload ?? {},
        metadata: body.metadata ?? {},
        observedAt: body.observedAt ?? new Date().toISOString(),
      },
      'adapter:channel-control',
    );
  }

  private assertInternalToken(token?: string) {
    const expected =
      this.configService.get<string>('AI_INTERNAL_TOKEN')?.trim() ||
      'local-ai-internal-token';

    if ((token || '').trim() !== expected) {
      throw new UnauthorizedException('Invalid internal token.');
    }
  }
}
