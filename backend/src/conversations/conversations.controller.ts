import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ConversationsService } from './conversations.service'
import { ListConversationsDto } from './dto/list-conversations.dto'
import { CreateWebchatSessionDto } from './dto/create-webchat-session.dto'
import { ReplyConversationDto } from './dto/reply-conversation.dto'
import { AssignConversationDto } from './dto/assign-conversation.dto'
import { ConversationHandoffDto } from './dto/conversation-handoff.dto'
import { CreateWebchatMessageDto } from './dto/create-webchat-message.dto'
import { AgentReplyDto } from './dto/agent-reply.dto'
import { DispatchWebchatMessageDto } from './dto/dispatch-webchat-message.dto'
import { GetWebchatSessionDto } from './dto/get-webchat-session.dto'
import { IngestInboundMessageDto } from './dto/ingest-inbound-message.dto'
import { SyncOutboundStatusDto } from './dto/sync-outbound-status.dto'
import { CreateAdminInternalSessionDto } from './dto/create-admin-internal-session.dto'
import { RerouteConversationDto } from './dto/reroute-conversation.dto'

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  list(
    @Query() query: ListConversationsDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.listConversations(query, Number(req.user?.sub))
  }

  @Get('inboxes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  listInboxes() {
    return this.conversations.listInboxes()
  }

  @Get('queues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  listQueues() {
    return this.conversations.listQueues()
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async getById(@Param('id') id: string) {
    const conversation = await this.conversations.getConversation(id)
    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }
    return conversation
  }

  @Post('admin-internal/session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  createAdminInternalSession(
    @Body() dto: CreateAdminInternalSessionDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.createAdminInternalSession(dto, Number(req.user?.sub))
  }

  @Post('webchat/session')
  createWebchatSession(@Body() dto: CreateWebchatSessionDto) {
    return this.conversations.createWebchatSession(dto)
  }

  @Get('webchat/session/:id')
  getWebchatSession(
    @Param('id') id: string,
    @Query() query: GetWebchatSessionDto,
  ) {
    return this.conversations.getWebchatSession(id, query)
  }

  @Post('webchat/message')
  createWebchatMessage(@Body() dto: CreateWebchatMessageDto) {
    return this.conversations.createWebchatMessage(dto)
  }

  @Post('webchat/dispatch')
  dispatchWebchatMessage(@Body() dto: DispatchWebchatMessageDto) {
    return this.conversations.dispatchWebchatMessage(dto)
  }

  @Post('internal/inbound')
  ingestInbound(
    @Body() dto: IngestInboundMessageDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    const expectedToken =
      this.config.get<string>('AI_INTERNAL_TOKEN') ||
      'local-ai-internal-token'

    if (!token || token !== expectedToken) {
      throw new NotFoundException('conversation.notFound')
    }

    return this.conversations.ingestInboundMessage(dto)
  }

  @Post('internal/outbound-status')
  syncOutboundStatus(
    @Body() dto: SyncOutboundStatusDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    const expectedToken =
      this.config.get<string>('AI_INTERNAL_TOKEN') ||
      'local-ai-internal-token'

    if (!token || token !== expectedToken) {
      throw new NotFoundException('conversation.notFound')
    }

    return this.conversations.syncOutboundStatus(dto)
  }

  @Post(':id/takeover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  takeover(
    @Param('id') id: string,
    @Body() dto: ConversationHandoffDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.takeoverConversation(id, Number(req.user?.sub), dto)
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  release(
    @Param('id') id: string,
    @Body() dto: ConversationHandoffDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.releaseConversation(id, Number(req.user?.sub), dto)
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.assignConversation(id, dto, Number(req.user?.sub))
  }

  @Post(':id/reroute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  reroute(
    @Param('id') id: string,
    @Body() dto: RerouteConversationDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.rerouteConversation(id, dto, Number(req.user?.sub))
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyConversationDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.replyAsOperator(id, dto, Number(req.user?.sub))
  }

  @Post(':id/agent-reply')
  async replyAsAgent(
    @Param('id') id: string,
    @Body() dto: AgentReplyDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    const expectedToken =
      this.config.get<string>('AI_INTERNAL_TOKEN') ||
      'local-ai-internal-token'

    if (!token || token !== expectedToken) {
      throw new NotFoundException('conversation.notFound')
    }

    return this.conversations.replyAsAgent(id, dto)
  }
}
