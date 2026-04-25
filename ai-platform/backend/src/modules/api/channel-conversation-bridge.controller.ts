import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChannelConversationBridgeService } from './channel-conversation-bridge.service';
import { InternalAgentReplyDto } from './dto/internal-agent-reply.dto';
import { InternalBootstrapChannelThreadDto } from './dto/internal-bootstrap-channel-thread.dto';
import { InternalChannelInboundMessageDto } from './dto/internal-channel-inbound-message.dto';
import { InternalSyncOutboundStatusDto } from './dto/internal-sync-outbound-status.dto';

@Controller('internal/conversations')
export class ChannelConversationBridgeController {
  constructor(
    private readonly bridgeService: ChannelConversationBridgeService,
    private readonly configService: ConfigService,
  ) {}

  @Post('inbound')
  ingestInbound(
    @Body() body: InternalChannelInboundMessageDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.ingestInboundMessage(body);
  }

  @Post('history-message')
  importHistory(
    @Body() body: InternalChannelInboundMessageDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.importHistoryMessage(body);
  }

  @Post('bootstrap-thread')
  bootstrapThread(
    @Body() body: InternalBootstrapChannelThreadDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.bootstrapChannelThread(body);
  }

  @Post('outbound-status')
  syncOutboundStatus(
    @Body() body: InternalSyncOutboundStatusDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.syncOutboundStatus(body);
  }

  @Post(':id/agent-reply')
  replyAsAgent(
    @Param('id') conversationId: string,
    @Body() body: InternalAgentReplyDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.replyAsAgent(conversationId, body);
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
