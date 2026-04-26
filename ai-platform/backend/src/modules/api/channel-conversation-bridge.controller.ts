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
import { InternalAgentOutboundDto } from './dto/internal-agent-outbound.dto';
import { InternalAgentTurnDto } from './dto/internal-agent-turn.dto';
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

  @Post(':id/replies/agent')
  replyAsAgent(
    @Param('id') conversationId: string,
    @Body() body: InternalAgentOutboundDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.replyAsAgent(conversationId, body);
  }

  @Post(':id/agent-turn')
  executeAgentTurn(
    @Param('id') conversationId: string,
    @Body() body: InternalAgentTurnDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token);
    return this.bridgeService.executeAgentTurn(conversationId, body);
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
