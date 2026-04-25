import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { PublicWebchatSessionRepository } from '../persistence/repositories/public-webchat-session.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { AsyncTurnIntakeService } from './async-turn-intake.service';
import { CreatePublicWebchatSessionDto } from './dto/create-public-webchat-session.dto';
import { PublicWebchatMessageDto } from './dto/public-webchat-message.dto';

@Injectable()
export class StorefrontWebchatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly publicWebchatSessionRepository: PublicWebchatSessionRepository,
    private readonly asyncTurnIntakeService: AsyncTurnIntakeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async createSession(input: CreatePublicWebchatSessionDto) {
    const locale = input.locale?.trim() || 'es-UY';
    const currency = input.currency?.trim() || 'UYU';
    const conversation = await this.conversationRepository.createConversation(
      locale,
      'webchat_async',
    );

    const projection = await this.publicWebchatSessionRepository.create({
      conversationId: conversation.id,
      guestId: input.guestId,
      scope: input.authenticated ? 'customer_authenticated' : 'customer_public',
      authenticated: input.authenticated === true,
      name: input.name ?? null,
      email: input.email ?? null,
      locale,
      currency,
      page: input.page ?? null,
      metadata: {
        tenantKey: input.tenantKey ?? this.tenantContext.getTenantId(),
      } as Prisma.InputJsonValue,
    });

    return this.buildSessionView(conversation.id, projection.guestId);
  }

  async getSession(conversationId: string, guestId?: string) {
    return this.buildSessionView(conversationId, guestId);
  }

  async sendMessage(input: PublicWebchatMessageDto) {
    const session = await this.getProjection(input.conversationId, input.guestId);
    const locale = input.locale?.trim() || session.locale;
    const currency = input.currency?.trim() || session.currency;
    const scope =
      input.scope ??
      (session.authenticated ? 'customer_authenticated' : 'customer_public');
    const normalizedText = this.buildNormalizedMessage(
      input.text ?? '',
      Array.isArray(input.attachments) ? input.attachments : [],
    );

    await this.publicWebchatSessionRepository.updateContext(input.conversationId, {
      locale,
      currency,
      page:
        input.metadata && typeof input.metadata.page === 'string'
          ? input.metadata.page
          : session.page,
      authenticated: input.authenticated ?? session.authenticated,
      scope,
    });

    const accepted = await this.asyncTurnIntakeService.acceptMessage({
      conversationId: input.conversationId,
      message: normalizedText,
      locale,
      channel: 'webchat_async',
    });

    return {
      ok: true,
      status: accepted.presence.state,
      queued: true,
      acceptedAt: accepted.turn.acceptedAt,
      flushDelayMs: accepted.turn.stabilizationDelayMs,
      coalescedInboundCount: accepted.turn.inputCount,
      normalized: {
        channel: 'webchat',
        scope,
        tenantKey: String(
          (session.metadata &&
          typeof session.metadata === 'object' &&
          'tenantKey' in session.metadata
            ? (session.metadata as Record<string, unknown>).tenantKey
            : null) ?? this.tenantContext.getTenantId(),
        ),
        userId: input.userId ?? session.guestId,
        conversationId: input.conversationId,
        text: normalizedText,
        attachments: input.attachments ?? [],
        metadata: input.metadata ?? null,
      },
      ai: null,
    };
  }

  private async buildSessionView(conversationId: string, guestId?: string) {
    const projection = await this.getProjection(conversationId, guestId);
    const session = await this.asyncTurnIntakeService.getSession(conversationId);
    const tenantKey = String(
      (projection.metadata &&
      typeof projection.metadata === 'object' &&
      'tenantKey' in projection.metadata
        ? (projection.metadata as Record<string, unknown>).tenantKey
        : null) ?? this.tenantContext.getTenantId(),
    );

    return {
      sessionId: projection.id,
      conversationId,
      tenantKey,
      scope: projection.scope,
      role: projection.scope,
      channel: 'webchat' as const,
      controlMode: 'ai' as const,
      needsHuman: false,
      participant: {
        guestId: projection.guestId,
        name: projection.name ?? null,
        email: projection.email ?? null,
        locale: projection.locale,
        currency: projection.currency,
      },
      context: {
        page: projection.page ?? null,
        currency: projection.currency,
      },
      aiState: null,
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role === 'USER' ? 'customer' : 'agent',
        kind: 'text',
        authorKind: message.role === 'USER' ? 'customer_human' : 'assistant_ai',
        messageKind: 'text',
        text: message.content,
        createdAt: message.createdAt,
        quotedMessage: null,
        reactions: [],
        editedAt: null,
        deleted: false,
        deletedAt: null,
        messageElements: this.readMessageElements(message.metadata),
        messageContextOrigin: this.readMessageContextOrigin(message.metadata),
        attachments: this.readMessageAttachments(message.metadata),
      })),
    };
  }

  private async getProjection(conversationId: string, guestId?: string) {
    const projection =
      await this.publicWebchatSessionRepository.findByConversationId(conversationId);

    if (!projection) {
      throw new NotFoundException(
        `Public webchat session for conversation "${conversationId}" was not found.`,
      );
    }

    if (guestId && projection.guestId !== guestId) {
      throw new NotFoundException(
        `Public webchat session "${conversationId}" was not found for the provided guest.`,
      );
    }

    return projection;
  }

  private buildNormalizedMessage(
    text: string,
    attachments: Array<{
      assetType?: string;
      fileName?: string;
      textContent?: string;
    }>,
  ) {
    const normalizedText = String(text || '').trim();
    const attachmentHints = attachments
      .map((attachment) =>
        String(
          attachment.textContent?.trim() ||
            attachment.fileName?.trim() ||
            attachment.assetType?.trim() ||
            '',
        ).trim(),
      )
      .filter(Boolean);

    if (normalizedText && attachmentHints.length === 0) {
      return normalizedText;
    }

    if (!normalizedText && attachmentHints.length > 0) {
      return `Adjuntos: ${attachmentHints.join(', ')}`;
    }

    if (!normalizedText) {
      return '';
    }

    return `${normalizedText}\n\nAdjuntos: ${attachmentHints.join(', ')}`;
  }

  private readMessageElements(metadata: Record<string, unknown> | null | undefined) {
    const value = metadata?.messageElements;
    return Array.isArray(value) ? value : [];
  }

  private readMessageContextOrigin(
    metadata: Record<string, unknown> | null | undefined,
  ) {
    const value = metadata?.messageContextOrigin;
    return Array.isArray(value) ? value : [];
  }

  private readMessageAttachments(
    metadata: Record<string, unknown> | null | undefined,
  ) {
    const value = metadata?.attachments;
    return Array.isArray(value) ? value : [];
  }
}
