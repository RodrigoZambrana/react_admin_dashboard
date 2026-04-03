import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByConversation(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
