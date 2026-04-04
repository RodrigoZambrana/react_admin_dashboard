import { AsyncChatController } from '../src/modules/api/async-chat.controller';

describe('AsyncChatController', () => {
  it('exposes additive async chat intake and session-sync contracts through the intake service boundary', async () => {
    const service = {
      acceptMessage: jest.fn(async () => ({
        conversationId: 'conv-1',
        turn: {
          id: 'turn-1',
          status: 'queued',
        },
      })),
      getSession: jest.fn(async () => ({
        presence: {
          state: 'awaiting_reply',
        },
      })),
      getTurn: jest.fn(async () => ({
        id: 'turn-1',
        status: 'completed',
      })),
    };
    const controller = new AsyncChatController(service as any);

    await expect(
      controller.acceptMessage({
        message: 'hola',
      } as any),
    ).resolves.toEqual({
      conversationId: 'conv-1',
      turn: {
        id: 'turn-1',
        status: 'queued',
      },
    });
    await expect(controller.getSession('conv-1')).resolves.toEqual({
      presence: {
        state: 'awaiting_reply',
      },
    });
    await expect(controller.getTurn('turn-1')).resolves.toEqual({
      id: 'turn-1',
      status: 'completed',
    });
  });
});
