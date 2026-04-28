import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { ChannelConversationBindingRepository } from '../persistence/repositories/channel-conversation-binding.repository';
import { ChannelMessageRecordRepository } from '../persistence/repositories/channel-message-record.repository';
import { ChatLogRepository } from '../persistence/repositories/chat-log.repository';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { InternalAgentOutboundDto } from './dto/internal-agent-outbound.dto';
import { InternalAgentTurnDto } from './dto/internal-agent-turn.dto';
import { InternalBootstrapChannelThreadDto } from './dto/internal-bootstrap-channel-thread.dto';
import { InternalChannelInboundMessageDto } from './dto/internal-channel-inbound-message.dto';
import { InternalSyncOutboundStatusDto } from './dto/internal-sync-outbound-status.dto';
import { SemanticTurnExecutionService } from './semantic-turn-execution.service';

@Injectable()
export class ChannelConversationBridgeService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly channelConversationBindingRepository: ChannelConversationBindingRepository,
    private readonly channelMessageRecordRepository: ChannelMessageRecordRepository,
    private readonly chatLogRepository: ChatLogRepository,
    private readonly semanticTurnExecutionService: SemanticTurnExecutionService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async ingestInboundMessage(input: InternalChannelInboundMessageDto) {
    const projection = await this.resolveOrCreateProjection(input);

    const duplicate =
      input.externalMessageId != null
        ? await this.channelMessageRecordRepository.findByExternalMessageId(
            input.channel,
            input.externalMessageId,
          )
        : null;

    if (duplicate) {
      return this.buildProjection(projection.conversationId, input, {
        duplicate: true,
      });
    }

    await this.conversationRepository.appendMessage(
      projection.conversationId,
      MessageRole.USER,
      this.resolveMessageContent(input),
      this.toJson({
        transport: 'channel_bridge',
        channel: input.channel,
        threadId: input.threadId ?? null,
        externalMessageId: input.externalMessageId ?? null,
        authorKind: input.authorKind ?? null,
        messageKind: input.messageKind ?? null,
        subject: input.subject ?? null,
        attachments: input.attachments ?? [],
        metadata: input.metadata ?? {},
      }),
    );

    if (input.externalMessageId) {
      await this.channelMessageRecordRepository.upsert({
        conversationId: projection.conversationId,
        channel: input.channel,
        externalMessageId: input.externalMessageId,
        providerMessageId: input.externalMessageId,
        direction:
          input.direction === 'outbound' ? 'outbound' : 'inbound',
        occurredAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      });
    }

    return this.buildProjection(projection.conversationId, input);
  }

  async importHistoryMessage(input: InternalChannelInboundMessageDto) {
    const result = await this.ingestInboundMessage({
      ...input,
      direction: input.direction ?? 'inbound',
    });

    return {
      conversationId: result.conversationId,
      duplicate: result.duplicate === true,
    };
  }

  async bootstrapChannelThread(input: InternalBootstrapChannelThreadDto) {
    const existing = await this.channelConversationBindingRepository.findByThread(
      input.channel,
      input.threadId,
    );

    if (existing) {
      return {
        conversationId: existing.conversationId,
        createdConversation: false,
      };
    }

    const conversation = await this.conversationRepository.createConversation(
      undefined,
      input.channel,
    );

    await this.channelConversationBindingRepository.upsert({
      conversationId: conversation.id,
      channel: input.channel,
      threadId: input.threadId,
      userId: input.userId,
      inboxAccountId: input.inboxAccountId ?? null,
      inboxAddress: input.inboxAddress ?? null,
      displayName: input.displayName ?? null,
      email: input.email ?? null,
      queueSlug: input.queueSlug ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    });

    return {
      conversationId: conversation.id,
      createdConversation: true,
    };
  }

  async replyAsAgent(conversationId: string, input: InternalAgentOutboundDto) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation "${conversationId}" was not found.`);
    }

    const content = (input.finalUserText || input.body || '').trim();
    const message = await this.conversationRepository.appendMessage(
      conversationId,
      MessageRole.ASSISTANT,
      content,
      this.toJson({
        transport: 'channel_bridge',
        body: input.body,
        finalUserText: input.finalUserText ?? null,
        debugSummary: input.debugSummary ?? null,
        auditPayload: input.auditPayload ?? null,
        metadata: input.metadata ?? {},
        toolCalls: input.toolCalls ?? [],
        needsHuman: input.needsHuman === true,
        grounding: input.grounding ?? null,
        audit: input.audit ?? null,
      }),
    );

    await this.channelMessageRecordRepository.upsert({
      conversationId,
      channel: conversation.channel,
      externalMessageId: message.id,
      providerMessageId: message.id,
      remoteId: message.id,
      direction: 'outbound',
      status: 'pending_external',
      occurredAt: message.createdAt,
      metadata: this.toJson({
        source: 'admin_ui',
        body: content,
        finalUserText: input.finalUserText ?? null,
        metadata: input.metadata ?? {},
      }),
    });

    return {
      id: message.id,
      conversationId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async executeAgentTurn(conversationId: string, input: InternalAgentTurnDto) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation "${conversationId}" was not found.`);
    }

    const message = String(input.message || '').trim();
    const result = await this.semanticTurnExecutionService.executeClosedTurn(
      {
        conversationId,
        message,
        locale: input.locale,
      },
      {
        projectReplyImmediately: false,
        persistIncomingMessage: false,
      },
    );

    return {
      response: {
        text: result.response,
        finalUserText: result.response,
        debugSummary: result.approvedResponseDraft,
        auditPayload: {
          intent: result.intent,
          entities: result.entities,
          decision: result.decision,
          execution: result.execution,
          continuity: result.continuity,
          conversationState: result.conversationState,
          approvedResponseContext: result.approvedResponse.approvedContext,
        },
        provider: result.interpretationResult.provider ?? 'ai-platform',
        model: result.interpretationResult.model ?? null,
        memory: {
          conversationContext: result.conversationState,
        },
        toolCalls: [],
      },
      metadata: result.metadata,
    };
  }

  async syncOutboundStatus(input: InternalSyncOutboundStatusDto) {
    const record = await this.channelMessageRecordRepository.upsert({
      conversationId: input.conversationId,
      channel: input.channel,
      externalMessageId:
        input.externalMessageId || input.providerMessageId || input.remoteId,
      providerMessageId: input.providerMessageId ?? null,
      remoteId: input.remoteId,
      direction: 'outbound',
      status: input.deliveryStatus,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      metadata: {
        ...(input.metadata ?? {}),
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        inboxAccountId: input.inboxAccountId ?? null,
      } as Prisma.InputJsonValue,
    });

    if (input.remoteId) {
      const message = await this.prisma.message.findFirst({
        where: {
          id: input.remoteId,
          conversationId: input.conversationId,
        },
        select: {
          metadata: true,
        },
      });

      const currentMetadata =
        message?.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
          ? (message.metadata as Record<string, unknown>)
          : {};

      const mergedMetadata = {
        ...currentMetadata,
        deliveryStatus: input.deliveryStatus,
        providerMessageId: input.providerMessageId ?? input.remoteId,
        remoteId: input.remoteId,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      } as Prisma.InputJsonValue;

      await this.prisma.message.updateMany({
        where: {
          id: input.remoteId,
          conversationId: input.conversationId,
        },
        data: {
          metadata: mergedMetadata,
        },
      });
    }

    await this.chatLogRepository.createLog({
      traceId: `outbound:${record.id}`,
      conversationId: input.conversationId,
      stage: 'channel_outbound_status',
      status: input.deliveryStatus,
      payload: {
        channel: input.channel,
        remoteId: input.remoteId,
        externalMessageId: input.externalMessageId ?? null,
        providerMessageId: input.providerMessageId ?? null,
        occurredAt: input.occurredAt ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        metadata: input.metadata ?? {},
      } as Prisma.InputJsonValue,
    });

    return {
      ok: true,
      recordId: record.id,
      status: input.deliveryStatus,
    };
  }

  private async resolveOrCreateProjection(input: InternalChannelInboundMessageDto) {
    if (input.conversationId) {
      const existingConversation = await this.conversationRepository.findById(
        input.conversationId,
      );

      if (existingConversation) {
        if (input.threadId) {
          await this.channelConversationBindingRepository.upsert({
            conversationId: existingConversation.id,
            channel: input.channel,
            threadId: input.threadId,
            userId: input.userId,
            inboxAccountId: input.inboxAccountId ?? null,
            inboxAddress: input.inboxAddress ?? null,
            displayName: input.displayName ?? null,
            email: input.email ?? null,
            queueSlug: input.queueSlug ?? null,
            metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          });
        }

        return { conversationId: existingConversation.id };
      }
    }

    if (input.threadId) {
      const binding = await this.channelConversationBindingRepository.findByThread(
        input.channel,
        input.threadId,
      );

      if (binding) {
        return { conversationId: binding.conversationId };
      }
    }

    const conversation = await this.conversationRepository.createConversation(
      undefined,
      input.channel,
    );

    await this.channelConversationBindingRepository.upsert({
      conversationId: conversation.id,
      channel: input.channel,
      threadId: input.threadId || `${input.channel}:${input.userId}`,
      userId: input.userId,
      inboxAccountId: input.inboxAccountId ?? null,
      inboxAddress: input.inboxAddress ?? null,
      displayName: input.displayName ?? null,
      email: input.email ?? null,
      queueSlug: input.queueSlug ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    });

    return { conversationId: conversation.id };
  }

  private buildProjection(
    conversationId: string,
    input: InternalChannelInboundMessageDto,
    options?: { duplicate?: boolean },
  ) {
    return {
      conversationId,
      controlMode: 'ai',
      channel: input.channel,
      scope: 'customer_public',
      preferences: {
        locale:
          (input.metadata &&
          typeof input.metadata.locale === 'string' &&
          input.metadata.locale) ||
          null,
        currency:
          (input.metadata &&
          typeof input.metadata.currency === 'string' &&
          input.metadata.currency) ||
          null,
      },
      duplicate: options?.duplicate === true,
    };
  }

  private resolveMessageContent(input: InternalChannelInboundMessageDto) {
    const text = String(input.text || '').trim();
    if (text) {
      return text;
    }

    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    const summary = attachments
      .map((attachment) =>
        String(
          attachment.textContent?.trim() ||
            attachment.fileName?.trim() ||
            attachment.assetType?.trim() ||
            '',
        ).trim(),
      )
      .filter(Boolean);

    if (summary.length > 0) {
      return `Adjuntos: ${summary.join(', ')}`;
    }

    return '[mensaje sin texto]';
  }

  private toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }
}
