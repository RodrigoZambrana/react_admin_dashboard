import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AsyncConversationTurnInputRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByTurn(turnId: string) {
    return this.prisma.asyncConversationTurnInput.findMany({
      where: { turnId },
      orderBy: {
        sequence: 'asc',
      },
    });
  }
}
