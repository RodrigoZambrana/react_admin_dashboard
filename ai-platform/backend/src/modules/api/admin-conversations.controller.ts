import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';
import { UpdateAdminConversationArchiveDto } from './dto/update-admin-conversation-archive.dto';
import { UpdateAdminConversationMuteDto } from './dto/update-admin-conversation-mute.dto';
import { UpdateAdminConversationOperatorDto } from './dto/update-admin-conversation-operator.dto';
import { AdminConversationsService } from './admin-conversations.service';

@Controller('admin/conversations')
export class AdminConversationsController {
  constructor(private readonly adminConversationsService: AdminConversationsService) {}

  @Get()
  listConversations(@Query() query: AdminConversationQueryDto) {
    return this.adminConversationsService.listConversations(query);
  }

  @Get(':conversationId')
  getConversation(
    @Param('conversationId') conversationId: string,
    @Query('actorKey') actorKey?: string,
  ) {
    return this.adminConversationsService.getConversation(conversationId, actorKey);
  }

  @Post(':conversationId/read')
  markRead(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationOperatorDto,
  ) {
    return this.adminConversationsService.markRead(conversationId, body.actorKey);
  }

  @Post(':conversationId/unread')
  markUnread(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationOperatorDto,
  ) {
    return this.adminConversationsService.markUnread(conversationId, body.actorKey);
  }

  @Post(':conversationId/pin')
  pin(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationOperatorDto,
  ) {
    return this.adminConversationsService.pin(conversationId, body.actorKey);
  }

  @Post(':conversationId/unpin')
  unpin(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationOperatorDto,
  ) {
    return this.adminConversationsService.unpin(conversationId, body.actorKey);
  }

  @Post(':conversationId/archive')
  archive(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationArchiveDto,
  ) {
    return this.adminConversationsService.setArchived(
      conversationId,
      body.archived,
      body.actorKey,
    );
  }

  @Post(':conversationId/mute-state')
  setMuteState(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationMuteDto,
  ) {
    return this.adminConversationsService.setMuteState(
      conversationId,
      body.preset,
      body.actorKey,
    );
  }

  @Post(':conversationId/delete')
  delete(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationOperatorDto,
  ) {
    return this.adminConversationsService.delete(conversationId, body.actorKey);
  }

  @Post(':conversationId/restore')
  restore(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateAdminConversationOperatorDto,
  ) {
    return this.adminConversationsService.restore(conversationId, body.actorKey);
  }
}
