import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreatePublicWebchatSessionInput = {
  conversationId: string;
  guestId: string;
  scope: string;
  authenticated: boolean;
  name?: string | null;
  email?: string | null;
  locale: string;
  currency: string;
  page?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type UpdatePublicWebchatSessionInput = Partial<
  Omit<CreatePublicWebchatSessionInput, 'conversationId' | 'guestId'>
>;

@Injectable()
export class PublicWebchatSessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get delegate() {
    return (this.prisma as any).publicWebchatSession;
  }

  create(input: CreatePublicWebchatSessionInput) {
    const tenantId = this.tenantContext.getTenantId();

    return this.delegate.create({
      data: {
        tenantId,
        conversationId: input.conversationId,
        guestId: input.guestId,
        scope: input.scope,
        authenticated: input.authenticated,
        name: input.name ?? null,
        email: input.email ?? null,
        locale: input.locale,
        currency: input.currency,
        page: input.page ?? null,
        metadata: input.metadata,
      },
    });
  }

  findByConversationId(conversationId: string) {
    const tenantId = this.tenantContext.getTenantId();

    return this.delegate.findFirst({
      where: {
        tenantId,
        conversationId,
      },
    });
  }

  updateContext(conversationId: string, input: UpdatePublicWebchatSessionInput) {
    const tenantId = this.tenantContext.getTenantId();

    return this.delegate.updateMany({
      where: {
        tenantId,
        conversationId,
      },
      data: {
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.authenticated !== undefined
          ? { authenticated: input.authenticated }
          : {}),
        ...(input.name !== undefined ? { name: input.name ?? null } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.page !== undefined ? { page: input.page ?? null } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  }
}
