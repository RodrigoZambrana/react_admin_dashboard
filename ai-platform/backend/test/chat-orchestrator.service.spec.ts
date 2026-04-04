import { ChatOrchestratorService } from '../src/modules/api/chat-orchestrator.service';

describe('ChatOrchestratorService', () => {
  it('creates a conversation when needed and delegates turn execution through the semantic pipeline service', async () => {
    const semanticTurnExecutionService = {
      executeClosedTurn: jest.fn(async () => ({
        response: 'Hello, how can I help you?',
        intent: 'GENERAL_CONVERSATION',
        entities: {},
        metadata: {
          conversationId: 'conv-1',
          traceId: 'trace-1',
        },
      })),
    };
    const conversationRepository = {
      findById: jest.fn(async () => null),
      createConversation: jest.fn(async () => ({ id: 'conv-1' })),
      listRecent: jest.fn(async () => []),
    };

    const service = new ChatOrchestratorService(
      conversationRepository as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      semanticTurnExecutionService as any,
    );

    await expect(
      service.handleMessage({
        message: 'hola',
        locale: 'es',
        channel: 'web',
      }),
    ).resolves.toEqual({
      response: 'Hello, how can I help you?',
      intent: 'GENERAL_CONVERSATION',
      entities: {},
      metadata: {
        conversationId: 'conv-1',
        traceId: 'trace-1',
      },
    });

    expect(conversationRepository.createConversation).toHaveBeenCalledWith(
      'es',
      'web',
    );
    expect(semanticTurnExecutionService.executeClosedTurn).toHaveBeenCalledWith(
      {
        conversationId: 'conv-1',
        message: 'hola',
        locale: 'es',
      },
      {
        projectReplyImmediately: true,
      },
    );
  });

  it('reuses an existing conversation when conversationId is provided', async () => {
    const semanticTurnExecutionService = {
      executeClosedTurn: jest.fn(async () => ({
        response: 'ok',
        intent: 'GENERAL_CONVERSATION',
        entities: {},
        metadata: {
          conversationId: 'conv-existing',
          traceId: 'trace-existing',
        },
      })),
    };
    const conversationRepository = {
      findById: jest.fn(async () => ({ id: 'conv-existing' })),
      createConversation: jest.fn(async () => ({ id: 'conv-new' })),
      listRecent: jest.fn(async () => []),
    };

    const service = new ChatOrchestratorService(
      conversationRepository as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      semanticTurnExecutionService as any,
    );

    await service.handleMessage({
      conversationId: 'conv-existing',
      message: 'hola',
    });

    expect(conversationRepository.findById).toHaveBeenCalledWith('conv-existing');
    expect(conversationRepository.createConversation).not.toHaveBeenCalled();
    expect(semanticTurnExecutionService.executeClosedTurn).toHaveBeenCalledWith(
      {
        conversationId: 'conv-existing',
        message: 'hola',
        locale: undefined,
      },
      {
        projectReplyImmediately: true,
      },
    );
  });

  it('lists conversations and messages through the repository layer', async () => {
    const conversationRepository = {
      findById: jest.fn(async () => null),
      createConversation: jest.fn(async () => ({ id: 'conv-1' })),
      listRecent: jest.fn(async () => [{ id: 'conv-1' }]),
    };
    const messageRepository = {
      listByConversation: jest.fn(async () => [{ id: 'msg-1' }]),
    };

    const service = new ChatOrchestratorService(
      conversationRepository as any,
      messageRepository as any,
      {
        executeClosedTurn: jest.fn(),
      } as any,
    );

    await expect(service.listConversations(7)).resolves.toEqual([{ id: 'conv-1' }]);
    await expect(service.listMessages('conv-1')).resolves.toEqual([{ id: 'msg-1' }]);
    expect(conversationRepository.listRecent).toHaveBeenCalledWith(7);
    expect(messageRepository.listByConversation).toHaveBeenCalledWith('conv-1');
  });
});
