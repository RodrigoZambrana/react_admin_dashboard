import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type SaveConversationStateInput = {
  conversationId: string;
  lane: string;
  lastIntent?: string | null;
  lastApprovedAction?: string | null;
  lastApprovedToolName?: string | null;
  approvedFacts?: Prisma.InputJsonValue | null;
  pendingFacts?: Prisma.InputJsonValue | null;
  missingFields: string[];
  nextUsefulField?: string | null;
  lastApprovedResult?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
};

@Injectable()
export class ConversationStateRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findByConversationId(conversationId: string) {
    return this.prisma.conversationState.findFirst({
      where: { conversationId },
    });
  }

  async save(input: SaveConversationStateInput) {
    const existing = await this.findByConversationId(input.conversationId);

    if (existing) {
      return this.prisma.conversationState.update({
        where: { id: existing.id },
        data: {
          lane: input.lane,
          lastIntent: input.lastIntent,
          lastApprovedAction: input.lastApprovedAction,
          lastApprovedToolName: input.lastApprovedToolName,
          approvedFacts: this.toJsonValue(input.approvedFacts),
          pendingFacts: this.toJsonValue(input.pendingFacts),
          missingFields: input.missingFields,
          nextUsefulField: input.nextUsefulField,
          lastApprovedResult: this.toJsonValue(input.lastApprovedResult),
          metadata: this.toJsonValue(input.metadata),
        },
      });
    }

    return this.prisma.conversationState.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        conversationId: input.conversationId,
        lane: input.lane,
        lastIntent: input.lastIntent,
        lastApprovedAction: input.lastApprovedAction,
        lastApprovedToolName: input.lastApprovedToolName,
        approvedFacts: this.toJsonValue(input.approvedFacts),
        pendingFacts: this.toJsonValue(input.pendingFacts),
        missingFields: input.missingFields,
        nextUsefulField: input.nextUsefulField,
        lastApprovedResult: this.toJsonValue(input.lastApprovedResult),
        metadata: this.toJsonValue(input.metadata),
      },
    });
  }

  deleteByConversationId(conversationId: string) {
    return this.prisma.conversationState.deleteMany({
      where: { conversationId },
    });
  }

  private toJsonValue(
    value: Prisma.InputJsonValue | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value;
  }
}
