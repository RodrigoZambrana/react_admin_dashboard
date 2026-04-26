import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
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
import { DispatchWebchatMessageDto } from './dto/dispatch-webchat-message.dto'
import { GetWebchatSessionDto } from './dto/get-webchat-session.dto'
import { CreateAdminInternalSessionDto } from './dto/create-admin-internal-session.dto'
import { RerouteConversationDto } from './dto/reroute-conversation.dto'
import { ListConversationContactsDto } from './dto/list-conversation-contacts.dto'
import { StartContactConversationDto } from './dto/start-contact-conversation.dto'
import { RecordConversationAiSuggestionFeedbackDto } from './dto/conversation-ai-suggestion-feedback.dto'
import { ReactWhatsappMessageDto } from './dto/react-whatsapp-message.dto'
import { ForwardWhatsappMessageDto } from './dto/forward-whatsapp-message.dto'
import { ReplyWhatsappMessageDto } from './dto/reply-whatsapp-message.dto'
import { EditWhatsappMessageDto } from './dto/edit-whatsapp-message.dto'
import { ReplyWebchatMessageDto } from './dto/reply-webchat-message.dto'
import { EditWebchatMessageDto } from './dto/edit-webchat-message.dto'
import { ReactWebchatMessageDto } from './dto/react-webchat-message.dto'
import { ToggleWebchatMessageStarDto } from './dto/toggle-webchat-message-star.dto'
import { ToggleWebchatChatArchiveDto } from './dto/toggle-webchat-chat-archive.dto'
import { SetWebchatChatMuteDto } from './dto/set-webchat-chat-mute.dto'
import { ToggleWhatsappMessageStarDto } from './dto/toggle-whatsapp-message-star.dto'
import { ToggleWhatsappChatArchiveDto } from './dto/toggle-whatsapp-chat-archive.dto'
import { ToggleWhatsappChatReadDto } from './dto/toggle-whatsapp-chat-read.dto'
import { ToggleWhatsappChatPinDto } from './dto/toggle-whatsapp-chat-pin.dto'
import { SetWhatsappChatMuteDto } from './dto/set-whatsapp-chat-mute.dto'
import { ConversationDebugDto } from './dto/conversation-debug.dto'

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  list(
    @Query() query: ListConversationsDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.listConversations(query, Number(req.user?.sub))
  }

  @Get('inboxes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  listInboxes() {
    return this.conversations.listInboxes()
  }

  @Get('queues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  listQueues() {
    return this.conversations.listQueues()
  }

  @Get('contacts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  listContacts(
    @Query() query: ListConversationContactsDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.listContacts(query, Number(req.user?.sub))
  }

  @Get(':id/debug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  async getDebugById(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const conversation = await this.conversations.getConversationDebug(
      id,
      Number(req.user?.sub),
    )
    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }
    return conversation
  }

  @Post(':id/debug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  runDebugById(
    @Param('id') id: string,
    @Body() dto: ConversationDebugDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.runConversationDebug(
      id,
      dto,
      Number(req.user?.sub),
    )
  }

  @Delete(':id/debug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  deleteDebugById(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.deleteConversationDebug(id, Number(req.user?.sub))
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  async getById(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const conversation = await this.conversations.getConversation(
      id,
      Number(req.user?.sub),
    )
    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }
    return conversation
  }

  @Post(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  markRead(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.markConversationRead(id, Number(req.user?.sub))
  }

  @Post(':id/unread')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  markUnread(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.markConversationUnread(id, Number(req.user?.sub))
  }

  @Post(':id/pin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  pin(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.pinConversation(id, Number(req.user?.sub))
  }

  @Post(':id/unpin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  unpin(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.unpinConversation(id, Number(req.user?.sub))
  }

  @Post('admin-internal/session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  createAdminInternalSession(
    @Body() dto: CreateAdminInternalSessionDto,
    @Req()
    req: FastifyRequest & {
      user: {
        sub: string
        role?: string
        authority?: string[]
        capabilityGroups?: string[]
        directCapabilities?: string[]
        capabilityEnvelope?: string[]
      }
    },
  ) {
    return this.conversations.createAdminInternalSession(
      dto,
      Number(req.user?.sub),
      req.user,
    )
  }

  @Post('contact-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  startContactSession(
    @Body() dto: StartContactConversationDto,
    @Req()
    req: FastifyRequest & {
      user: {
        sub: string
        role?: string
        authority?: string[]
        capabilityGroups?: string[]
        directCapabilities?: string[]
        capabilityEnvelope?: string[]
      }
    },
  ) {
    return this.conversations.startConversationFromContact(
      dto,
      Number(req.user?.sub),
      req.user,
    )
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

  @Post(':id/takeover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  takeover(
    @Param('id') id: string,
    @Body() dto: ConversationHandoffDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.takeoverConversation(id, Number(req.user?.sub), dto)
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  release(
    @Param('id') id: string,
    @Body() dto: ConversationHandoffDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.releaseConversation(id, Number(req.user?.sub), dto)
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
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

  @Post(':id/messages/:messageId/webchat/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  replyToWebchatMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: ReplyWebchatMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.replyToWebchatMessage(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/webchat/edit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  editWebchatMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: EditWebchatMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.editWebchatMessage(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/webchat/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  deleteWebchatMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.deleteWebchatMessage(
      conversationId,
      messageId,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/webchat/reaction')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  reactToWebchatMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: ReactWebchatMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.reactToWebchatMessage(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/webchat/star')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  toggleWebchatMessageStar(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: ToggleWebchatMessageStarDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.toggleWebchatMessageStar(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/webchat/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  toggleWebchatChatArchive(
    @Param('id') conversationId: string,
    @Body() body: ToggleWebchatChatArchiveDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.toggleWebchatChatArchive(
      conversationId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/webchat/mute-state')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  setWebchatChatMuteState(
    @Param('id') conversationId: string,
    @Body() body: SetWebchatChatMuteDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.setWebchatChatMuteState(
      conversationId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/webchat/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  deleteWebchatChat(
    @Param('id') conversationId: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.deleteWebchatChat(
      conversationId,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/whatsapp/reaction')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  reactToWhatsappMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReactWhatsappMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.reactToWhatsappMessage(
      id,
      messageId,
      dto,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/whatsapp/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  replyToWhatsappMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: ReplyWhatsappMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.replyToWhatsappMessage(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/whatsapp/edit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  editWhatsappMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: EditWhatsappMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.editWhatsappMessage(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/whatsapp/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  deleteWhatsappMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.deleteWhatsappMessage(
      conversationId,
      messageId,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/whatsapp/star')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  toggleWhatsappMessageStar(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: ToggleWhatsappMessageStarDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.toggleWhatsappMessageStar(
      conversationId,
      messageId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/messages/:messageId/whatsapp/forward')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  forwardWhatsappMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: ForwardWhatsappMessageDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.forwardWhatsappMessage(
      id,
      messageId,
      dto,
      Number(req.user?.sub),
    )
  }

  @Post(':id/whatsapp/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  toggleWhatsappChatArchive(
    @Param('id') conversationId: string,
    @Body() body: ToggleWhatsappChatArchiveDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.toggleWhatsappChatArchive(
      conversationId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/whatsapp/read-state')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  toggleWhatsappChatReadState(
    @Param('id') conversationId: string,
    @Body() body: ToggleWhatsappChatReadDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.toggleWhatsappChatReadState(
      conversationId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/whatsapp/pin-state')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  toggleWhatsappChatPinState(
    @Param('id') conversationId: string,
    @Body() body: ToggleWhatsappChatPinDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.toggleWhatsappChatPinState(
      conversationId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/whatsapp/mute-state')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  setWhatsappChatMuteState(
    @Param('id') conversationId: string,
    @Body() body: SetWhatsappChatMuteDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.setWhatsappChatMuteState(
      conversationId,
      body,
      Number(req.user?.sub),
    )
  }

  @Post(':id/whatsapp/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  deleteWhatsappChat(
    @Param('id') conversationId: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.deleteWhatsappChat(
      conversationId,
      Number(req.user?.sub),
    )
  }

  @Get(':id/messages/:messageId/whatsapp/media/:attachmentIndex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  async downloadWhatsappMedia(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Param('attachmentIndex') attachmentIndex: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
    @Res() res: FastifyReply,
  ) {
    const media = await this.conversations.downloadWhatsappMessageMedia(
      id,
      messageId,
      Number(attachmentIndex),
      Number(req.user?.sub),
    )

    res.header(
      'content-type',
      media.contentType || 'application/octet-stream',
    )
    res.header(
      'content-disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(
        media.fileName || 'whatsapp-media',
      )}`,
    )
    res.send(media.buffer)
  }

  @Post(':id/ai-suggestions/feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  recordAiSuggestionFeedback(
    @Param('id') id: string,
    @Body() dto: RecordConversationAiSuggestionFeedbackDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.recordConversationSuggestionFeedback(
      id,
      dto.feedback,
      Number(req.user?.sub),
    )
  }

}
