import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreatePublicWebchatSessionDto } from './dto/create-public-webchat-session.dto';
import { PublicWebchatMessageDto } from './dto/public-webchat-message.dto';
import { StorefrontWebchatService } from './storefront-webchat.service';

@Controller('chat/public/webchat')
export class StorefrontWebchatController {
  constructor(private readonly storefrontWebchatService: StorefrontWebchatService) {}

  @Post('session')
  createSession(@Body() body: CreatePublicWebchatSessionDto) {
    return this.storefrontWebchatService.createSession(body);
  }

  @Get('session/:conversationId')
  getSession(
    @Param('conversationId') conversationId: string,
    @Query('guestId') guestId?: string,
  ) {
    return this.storefrontWebchatService.getSession(conversationId, guestId);
  }

  @Post('messages')
  sendMessage(@Body() body: PublicWebchatMessageDto) {
    return this.storefrontWebchatService.sendMessage(body);
  }
}
