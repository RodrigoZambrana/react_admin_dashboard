import { Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, ConversationOperatorState, Message, MessageRole } from '@prisma/client';

import {
  ConversationOperatorStateRepository,
  DEFAULT_CONVERSATION_ACTOR_KEY,
} from '../persistence/repositories/conversation-operator-state.repository';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { ChannelConversationBridgeService } from './channel-conversation-bridge.service';
import { AdminConversationReplyDto } from './dto/admin-conversation-reply.dto';
import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';

type ConversationWithProjection = Conversation & {
  messages: Message[];
  publicWebchatSession: {
    guestId: string;
    name: string | null;
    email: string | null;
    locale: string;
    currency: string;
    page: string | null;
  } | null;
  channelBindings: Array<{
    channel: string;
    threadId: string;
    userId: string;
    displayName: string | null;
    email: string | null;
    inboxAccountId: string | null;
    inboxAddress: string | null;
    queueSlug: string | null;
  }>;
};

@Injectable()
export class AdminConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly operatorStateRepository: ConversationOperatorStateRepository,
    private readonly channelConversationBridgeService: ChannelConversationBridgeService,
  ) {}

  async listConversations(query: AdminConversationQueryDto = {}) {
    const tenantId = this.tenantContext.getTenantId();
    const actorKey = this.resolveActorKey(query.actorKey);
    const limit = this.resolveLimit(query.limit);
    const includeArchived = query.includeArchived === 'true';
    const includeDeleted = query.includeDeleted === 'true';
    const take = Math.min(Math.max(limit * 4, limit), 200);
    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      include: {
        publicWebchatSession: {
          select: {
            guestId: true,
            name: true,
            email: true,
            locale: true,
            currency: true,
            page: true,
          },
        },
        channelBindings: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            channel: true,
            threadId: true,
            userId: true,
            displayName: true,
            email: true,
            inboxAccountId: true,
            inboxAddress: true,
            queueSlug: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const stateByConversationId = await this.getStateMap(
      conversations.map((conversation) => conversation.id),
      actorKey,
    );
    const summaries = await Promise.all(
      conversations.map((conversation) =>
        this.mapConversationSummary(
          conversation,
          stateByConversationId.get(conversation.id) ?? null,
          actorKey,
        ),
      ),
    );

    return {
      items: summaries
        .filter((summary) => includeArchived || !summary.channelState.archived)
        .filter((summary) => includeDeleted || !summary.channelState.deleted)
        .sort((left, right) => {
          const pinnedDiff =
            Number(Boolean(right.channelState.pinned)) -
            Number(Boolean(left.channelState.pinned));

          if (pinnedDiff !== 0) {
            return pinnedDiff;
          }

          return (
            new Date(right.latestTimestamp ?? right.updatedAt).getTime() -
            new Date(left.latestTimestamp ?? left.updatedAt).getTime()
          );
        })
        .slice(0, limit),
      limit,
      actorKey,
    };
  }

  async getConversation(conversationId: string, actorKey?: string | null) {
    const conversation = await this.getConversationOrThrow(conversationId, {
      includeAllMessages: true,
    });
    const resolvedActorKey = this.resolveActorKey(actorKey);
    const state = await this.operatorStateRepository.find(
      conversation.id,
      resolvedActorKey,
    );
    const summary = await this.mapConversationSummary(
      conversation,
      state,
      resolvedActorKey,
    );

    return {
      ...summary,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        authorType: message.role === MessageRole.USER ? 'customer' : 'agent',
        authorKind:
          message.role === MessageRole.USER ? 'customer' : 'assistant_ai',
        authorLabel:
          message.role === MessageRole.USER
            ? summary.participant.displayName
            : 'AI Concierge',
        kind: 'text',
        messageKind: 'text',
        body: message.content,
        normalizedText: message.content,
        payload: null,
        metadata: (message.metadata ?? null) as Record<string, unknown> | null,
        sentAt:
          message.role === MessageRole.ASSISTANT
            ? message.createdAt.toISOString()
            : null,
        receivedAt:
          message.role === MessageRole.USER ? message.createdAt.toISOString() : null,
        createdAt: message.createdAt.toISOString(),
        queue: null,
        transportEvents: [],
      })),
      handoffEvents: [],
      toolCalls: [],
      aiSuggestions: {
        conversationId: conversation.id,
        targetMessageId: null,
        items: [],
      },
    };
  }

  async reply(conversationId: string, input: AdminConversationReplyDto) {
    await this.ensureConversationExists(conversationId);
    await this.channelConversationBridgeService.replyAsAgent(conversationId, {
      body: input.body,
      finalUserText: input.body,
      metadata: {
        source: 'admin_ui',
        kind: input.kind ?? 'text',
        attachments: input.attachments ?? [],
      },
      auditPayload: input.aiSuggestionFeedback ?? undefined,
    });

    return this.getConversation(conversationId);
  }

  async markRead(conversationId: string, actorKey?: string | null) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      lastReadAt: new Date(),
      manualUnread: false,
    });

    return this.getConversation(conversationId, actorKey);
  }

  async markUnread(conversationId: string, actorKey?: string | null) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      manualUnread: true,
    });

    return this.getConversation(conversationId, actorKey);
  }

  async pin(conversationId: string, actorKey?: string | null) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      pinnedAt: new Date(),
    });

    return this.getConversation(conversationId, actorKey);
  }

  async unpin(conversationId: string, actorKey?: string | null) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      pinnedAt: null,
    });

    return this.getConversation(conversationId, actorKey);
  }

  async setArchived(
    conversationId: string,
    archived: boolean,
    actorKey?: string | null,
  ) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      archivedAt: archived ? new Date() : null,
    });

    return this.getConversation(conversationId, actorKey);
  }

  async setMuteState(
    conversationId: string,
    preset: 'off' | '8h' | '7d',
    actorKey?: string | null,
  ) {
    await this.ensureConversationExists(conversationId);
    const durationMs = this.resolveMuteDurationMs(preset);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      mutePreset: durationMs == null ? null : preset,
      mutedUntil:
        durationMs == null ? null : new Date(Date.now() + durationMs),
    });

    return this.getConversation(conversationId, actorKey);
  }

  async delete(conversationId: string, actorKey?: string | null) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      deletedAt: new Date(),
    });

    return {
      ok: true,
      conversationId,
      deleted: true,
    };
  }

  async restore(conversationId: string, actorKey?: string | null) {
    await this.ensureConversationExists(conversationId);
    await this.operatorStateRepository.upsert({
      conversationId,
      actorKey,
      deletedAt: null,
      archivedAt: null,
    });

    return this.getConversation(conversationId, actorKey);
  }

  private async mapConversationSummary(
    conversation: ConversationWithProjection,
    state: ConversationOperatorState | null,
    actorKey: string,
  ) {
    const latestMessage = conversation.messages[0] ?? null;
    const unreadCount = await this.countUnread(conversation.id, state);
    const participant = this.resolveParticipant(conversation);
    const displayChannel = this.resolveDisplayChannel(conversation);
    const latestMessageAt = latestMessage?.createdAt.toISOString() ?? null;
    const latestInboundAt =
      latestMessage?.role === MessageRole.USER ? latestMessageAt : null;
    const latestOutboundAt =
      latestMessage?.role === MessageRole.ASSISTANT ? latestMessageAt : null;
    const channelState = {
      actorKey,
      archived: Boolean(state?.archivedAt),
      archivedAt: state?.archivedAt?.toISOString() ?? null,
      read: unreadCount === 0 && !state?.manualUnread,
      pinned: Boolean(state?.pinnedAt),
      pinnedAt: state?.pinnedAt?.toISOString() ?? null,
      muted: Boolean(state?.mutedUntil && state.mutedUntil.getTime() > Date.now()),
      mutePreset: state?.mutePreset ?? null,
      mutedUntil: state?.mutedUntil?.toISOString() ?? null,
      deleted: Boolean(state?.deletedAt),
      deletedAt: state?.deletedAt?.toISOString() ?? null,
      updatedAt: state?.updatedAt?.toISOString() ?? null,
    };

    return {
      id: conversation.id,
      conversationId: conversation.id,
      tenantKey: conversation.tenantId,
      scope: 'customer_public',
      role: 'customer_public',
      language: conversation.language ?? null,
      channel: displayChannel,
      status: 'open',
      controlMode: 'ai',
      needsHuman: false,
      subject: participant.displayName,
      externalUserId: participant.userId ?? participant.guestId,
      externalThreadId: participant.threadId,
      externalChannelRef: participant.inboxAddress,
      isPinned: Boolean(state?.pinnedAt),
      pinnedAt: state?.pinnedAt?.toISOString() ?? null,
      lastMessageAt: latestMessageAt,
      lastInboundAt: latestInboundAt,
      lastOutboundAt: latestOutboundAt,
      participant,
      customer: null,
      assignedToUser: null,
      inboxAccount: participant.inboxAccountId
        ? {
            id: participant.inboxAccountId,
            displayName: participant.inboxAddress,
            address: participant.inboxAddress,
            channel: displayChannel,
            transport: conversation.channel,
          }
        : null,
      queue: participant.queueSlug
        ? {
            id: participant.queueSlug,
            slug: participant.queueSlug,
            name: participant.queueSlug,
            priority: 0,
            slaTargetMinutes: 0,
          }
        : null,
      operational: {
        needsAssignment: false,
        isSlaBreached: false,
        slaAgeMinutes: null,
        slaTargetMinutes: null,
      },
      aiState: null,
      aiAudit: {
        total: 0,
        search: 0,
        state: 0,
        parser: 0,
        crud: 0,
        latestToolName: null,
        latestStatus: null,
        updatedAt: null,
      },
      participants: [],
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      latestTimestamp:
        latestMessage?.createdAt.toISOString() ?? conversation.updatedAt.toISOString(),
      latestMessage: latestMessage
        ? {
            id: latestMessage.id,
            role: latestMessage.role,
            authorType:
              latestMessage.role === MessageRole.USER ? 'customer' : 'agent',
            authorUser: null,
            authorLabel:
              latestMessage.role === MessageRole.USER
                ? participant.displayName
                : 'AI Concierge',
            kind: 'text',
            body: latestMessage.content,
            preview: latestMessage.content,
            previewKind: 'text',
            createdAt: latestMessage.createdAt.toISOString(),
            metadata: (latestMessage.metadata ?? null) as
              | Record<string, unknown>
              | null,
          }
        : null,
      readState: {
        lastReadAt: state?.lastReadAt?.toISOString() ?? null,
        unreadCount,
        isRead: unreadCount === 0 && !state?.manualUnread,
        manualUnread: state?.manualUnread ?? false,
      },
      channelState,
      actionState: channelState,
    };
  }

  private async countUnread(
    conversationId: string,
    state: ConversationOperatorState | null,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const userMessageFilter = {
      tenantId,
      conversationId,
      role: MessageRole.USER,
      ...(state?.lastReadAt ? { createdAt: { gt: state.lastReadAt } } : {}),
    };
    const unreadCount = await this.prisma.message.count({
      where: userMessageFilter,
    });

    if (state?.manualUnread) {
      return Math.max(1, unreadCount);
    }

    return unreadCount;
  }

  private resolveParticipant(conversation: ConversationWithProjection) {
    const binding = conversation.channelBindings[0] ?? null;
    const webchat = conversation.publicWebchatSession;
    const displayName =
      binding?.displayName ||
      webchat?.name ||
      webchat?.email ||
      binding?.email ||
      binding?.userId ||
      webchat?.guestId ||
      'Conversación';

    return {
      displayName,
      guestId: webchat?.guestId ?? null,
      userId: binding?.userId ?? null,
      email: webchat?.email ?? binding?.email ?? null,
      threadId: binding?.threadId ?? null,
      inboxAccountId: binding?.inboxAccountId ?? null,
      inboxAddress: binding?.inboxAddress ?? null,
      queueSlug: binding?.queueSlug ?? null,
      locale: webchat?.locale ?? conversation.language ?? null,
      currency: webchat?.currency ?? null,
      page: webchat?.page ?? null,
    };
  }

  private resolveDisplayChannel(conversation: ConversationWithProjection) {
    if (conversation.publicWebchatSession || conversation.channel === 'webchat_async') {
      return 'webchat';
    }

    const binding = conversation.channelBindings[0] ?? null;

    if (binding?.channel === 'whatsapp-qr') {
      return 'whatsapp';
    }

    return conversation.channel;
  }

  private async getConversationOrThrow(
    conversationId: string,
    options: { includeAllMessages: boolean },
  ): Promise<ConversationWithProjection> {
    const tenantId = this.tenantContext.getTenantId();
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        id: conversationId,
      },
      include: {
        publicWebchatSession: {
          select: {
            guestId: true,
            name: true,
            email: true,
            locale: true,
            currency: true,
            page: true,
          },
        },
        channelBindings: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            channel: true,
            threadId: true,
            userId: true,
            displayName: true,
            email: true,
            inboxAccountId: true,
            inboxAddress: true,
            queueSlug: true,
          },
        },
        messages: {
          orderBy: { createdAt: options.includeAllMessages ? 'asc' : 'desc' },
          take: options.includeAllMessages ? undefined : 1,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation "${conversationId}" was not found.`,
      );
    }

    return conversation;
  }

  private async ensureConversationExists(conversationId: string) {
    await this.getConversationOrThrow(conversationId, { includeAllMessages: false });
  }

  private async getStateMap(conversationIds: string[], actorKey: string) {
    const states = await this.operatorStateRepository.listByConversationIds(
      conversationIds,
      actorKey,
    );

    return new Map(states.map((state) => [state.conversationId, state] as const));
  }

  private resolveActorKey(actorKey?: string | null) {
    return actorKey?.trim() || DEFAULT_CONVERSATION_ACTOR_KEY;
  }

  private resolveLimit(limit?: string | null) {
    const parsed = Number(limit ?? 30);

    if (!Number.isFinite(parsed)) {
      return 30;
    }

    return Math.min(Math.max(Math.trunc(parsed), 1), 100);
  }

  private resolveMuteDurationMs(preset: 'off' | '8h' | '7d') {
    if (preset === '8h') {
      return 8 * 60 * 60 * 1000;
    }

    if (preset === '7d') {
      return 7 * 24 * 60 * 60 * 1000;
    }

    return null;
  }
}
