import { AdminConversationsService } from '../admin-conversations.service';

function buildConversation() {
  const now = new Date('2026-04-27T10:00:00.000Z');
  return {
    id: 'conv-1',
    tenantId: 'tenant-a',
    language: 'es',
    channel: 'email',
    createdAt: now,
    updatedAt: now,
    messages: [],
    publicWebchatSession: null,
    channelBindings: [
      {
        channel: 'email',
        threadId: 'thread-1',
        userId: 'user-1',
        displayName: 'Cliente',
        email: 'cliente@example.com',
        inboxAccountId: 'inbox-1',
        inboxAddress: 'support@example.com',
        queueSlug: 'support',
      },
    ],
  } as any;
}

function createService() {
  const conversation = buildConversation();
  const prisma = {
    conversation: {
      findMany: jest.fn().mockResolvedValue([conversation]),
      findFirst: jest.fn().mockResolvedValue(conversation),
    },
    message: {
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue('tenant-a'),
  } as any;
  const operatorStateRepository = {
    find: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
    listByConversationIds: jest.fn().mockResolvedValue([]),
  } as any;
  const channelConversationBridgeService = {
    replyAsAgent: jest.fn().mockResolvedValue({}),
  } as any;

  return {
    service: new AdminConversationsService(
      prisma,
      tenantContext,
      operatorStateRepository,
      channelConversationBridgeService,
    ),
    prisma,
    tenantContext,
    operatorStateRepository,
    channelConversationBridgeService,
  };
}

describe('AdminConversationsService', () => {
  it('marks conversations as read and updates operator state', async () => {
    const { service, operatorStateRepository } = createService();

    const result = await service.markRead('conv-1', 'operator');

    expect(operatorStateRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        actorKey: 'operator',
        manualUnread: false,
      }),
    );
    expect(result.channelState.read).toBe(true);
  });

  it('archives and restores conversations through operator state', async () => {
    const { service, operatorStateRepository } = createService();

    await service.setArchived('conv-1', true, 'operator');
    await service.restore('conv-1', 'operator');

    expect(operatorStateRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        actorKey: 'operator',
        archivedAt: null,
      }),
    );
  });

  it('returns a deleted acknowledgement when deleting a conversation', async () => {
    const { service, operatorStateRepository } = createService();

    const result = await service.delete('conv-1', 'operator');

    expect(operatorStateRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        actorKey: 'operator',
        deletedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({ ok: true, conversationId: 'conv-1', deleted: true });
  });
});
