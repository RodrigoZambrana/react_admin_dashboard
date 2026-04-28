import { ChannelConversationBridgeService } from '../channel-conversation-bridge.service';

function createService() {
  const conversationRepository = {
    findById: jest.fn(),
    appendMessage: jest.fn(),
    createConversation: jest.fn().mockResolvedValue({ id: 'conv-1' }),
  } as any;
  const channelConversationBindingRepository = {
    findByThread: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  } as any;
  const channelMessageRecordRepository = {
    findByExternalMessageId: jest.fn(),
    upsert: jest.fn().mockResolvedValue({ id: 'record-1' }),
  } as any;
  const chatLogRepository = {
    createLog: jest.fn().mockResolvedValue({}),
  } as any;
  const semanticTurnExecutionService = {
    executeClosedTurn: jest.fn(),
  } as any;
  const prisma = {
    message: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;
  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue('tenant-a'),
  } as any;

  return {
    service: new ChannelConversationBridgeService(
      conversationRepository,
      channelConversationBindingRepository,
      channelMessageRecordRepository,
      chatLogRepository,
      semanticTurnExecutionService,
      prisma,
      tenantContext,
    ),
    conversationRepository,
    channelConversationBindingRepository,
    channelMessageRecordRepository,
    chatLogRepository,
    semanticTurnExecutionService,
    prisma,
    tenantContext,
  };
}

describe('ChannelConversationBridgeService', () => {
  it('skips duplicate inbound messages by externalMessageId', async () => {
    const { service, conversationRepository, channelMessageRecordRepository } = createService();

    channelMessageRecordRepository.findByExternalMessageId.mockResolvedValue({
      id: 'record-existing',
    });
    conversationRepository.findById.mockResolvedValue({ id: 'conv-1' });

    const result = await service.ingestInboundMessage({
      tenantKey: 'tenant-a',
      channel: 'email',
      userId: 'user-1',
      threadId: 'thread-1',
      externalMessageId: 'msg-1',
      text: 'Hola',
    } as any);

    expect(conversationRepository.appendMessage).not.toHaveBeenCalled();
    expect(channelMessageRecordRepository.upsert).not.toHaveBeenCalled();
    expect(result.duplicate).toBe(true);
  });

  it('persists the first inbound message and records it once', async () => {
    const { service, conversationRepository, channelMessageRecordRepository } = createService();

    channelMessageRecordRepository.findByExternalMessageId.mockResolvedValue(null);
    conversationRepository.appendMessage.mockResolvedValue({
      id: 'msg-1',
      content: 'Hola',
      createdAt: new Date('2026-04-27T10:00:00.000Z'),
    });

    const result = await service.ingestInboundMessage({
      tenantKey: 'tenant-a',
      channel: 'email',
      userId: 'user-1',
      threadId: 'thread-1',
      externalMessageId: 'msg-1',
      text: 'Hola',
    } as any);

    expect(conversationRepository.appendMessage).toHaveBeenCalledTimes(1);
    expect(channelMessageRecordRepository.upsert).toHaveBeenCalledTimes(1);
    expect(result.duplicate).toBe(false);
  });
});
