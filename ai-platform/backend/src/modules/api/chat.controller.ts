import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { ChatLogRepository } from '../persistence/repositories/chat-log.repository';
import { PromptService } from '../prompt/prompt.service';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';

@Controller()
export class ChatController {
  constructor(
    private readonly chatOrchestratorService: ChatOrchestratorService,
    private readonly chatLogRepository: ChatLogRepository,
    private readonly promptService: PromptService,
  ) {}

  @Post('chat/message')
  sendMessage(@Body() body: ChatMessageDto) {
    return this.chatOrchestratorService.handleMessage(body);
  }

  @Get('conversations')
  listConversations(@Query('limit') limit?: string) {
    return this.chatOrchestratorService.listConversations(Number(limit ?? 20));
  }

  @Get('conversations/:conversationId/messages')
  listMessages(@Param('conversationId') conversationId: string) {
    return this.chatOrchestratorService.listMessages(conversationId);
  }

  @Get('logs')
  listLogs(@Query('limit') limit?: string) {
    return this.chatLogRepository.listRecent(Number(limit ?? 100));
  }

  @Get('logs/:traceId')
  getTrace(@Param('traceId') traceId: string) {
    return this.chatLogRepository.getTrace(traceId);
  }

  @Get('prompts')
  listPrompts() {
    return this.promptService.listPrompts();
  }

  @Post('prompts')
  createPromptVersion(@Body() body: CreatePromptVersionDto) {
    return this.promptService.createPromptVersion(body);
  }
}
