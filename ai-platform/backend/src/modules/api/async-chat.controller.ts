import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { AsyncChatMessageDto } from './dto/async-chat-message.dto';
import { AsyncTurnIntakeService } from './async-turn-intake.service';

@Controller('chat/async')
export class AsyncChatController {
  constructor(private readonly asyncTurnIntakeService: AsyncTurnIntakeService) {}

  @Post('messages')
  acceptMessage(@Body() body: AsyncChatMessageDto) {
    return this.asyncTurnIntakeService.acceptMessage(body);
  }

  @Get('conversations/:conversationId/session')
  getSession(@Param('conversationId') conversationId: string) {
    return this.asyncTurnIntakeService.getSession(conversationId);
  }

  @Get('turns/:turnId')
  getTurn(@Param('turnId') turnId: string) {
    return this.asyncTurnIntakeService.getTurn(turnId);
  }
}
