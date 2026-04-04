import { Injectable } from '@nestjs/common';

import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { MessageRepository } from '../persistence/repositories/message.repository';
import { ChatMessageDto } from './dto/chat-message.dto';
import { SemanticTurnExecutionService } from './semantic-turn-execution.service';

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly semanticTurnExecutionService: SemanticTurnExecutionService,
  ) {}

  async handleMessage(input: ChatMessageDto) {
    const conversation = await this.resolveConversation(input);
    const result = await this.semanticTurnExecutionService.executeClosedTurn(
      {
        conversationId: conversation.id,
        message: input.message,
        locale: input.locale,
      },
      {
        projectReplyImmediately: true,
      },
    );

    return {
      response: result.response,
      intent: result.intent,
      entities: result.entities,
      metadata: result.metadata,
    };
  }

  async listConversations(limit = 20) {
    return this.conversationRepository.listRecent(limit);
  }

  async listMessages(conversationId: string) {
    return this.messageRepository.listByConversation(conversationId);
  }

  private async resolveConversation(input: ChatMessageDto) {
    if (input.conversationId) {
      const existing = await this.conversationRepository.findById(
        input.conversationId,
      );

      if (existing) {
        return existing;
      }
    }

    return this.conversationRepository.createConversation(
      input.locale,
      input.channel,
    );
  }
}
