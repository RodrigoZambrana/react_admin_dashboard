import { StorefrontWebchatService } from '../storefront-webchat.service';

describe('StorefrontWebchatService', () => {
  it('preserves attachment metadata when accepting a public webchat message', async () => {
    const conversationRepository = {
      createConversation: jest.fn(),
      findById: jest.fn(),
      countMessages: jest.fn(),
      appendMessage: jest.fn(),
    };
    const publicWebchatSessionRepository = {
      create: jest.fn(),
      findByConversationId: jest.fn().mockResolvedValue({
        id: 'session-1',
        conversationId: 'conv-1',
        guestId: 'guest-1',
        scope: 'customer_public',
        authenticated: false,
        name: null,
        email: null,
        locale: 'es-UY',
        currency: 'UYU',
        page: null,
        metadata: { tenantKey: 'tenant-a' },
      }),
      updateContext: jest.fn(),
    };
    const asyncTurnIntakeService = {
      acceptMessage: jest.fn().mockResolvedValue({
        presence: { state: 'idle' },
        turn: {
          acceptedAt: new Date(),
          stabilizationDelayMs: 0,
          inputCount: 1,
        },
      }),
      getSession: jest.fn().mockResolvedValue({
        messages: [],
      }),
    };
    const tenantContext = {
      getTenantId: jest.fn().mockReturnValue('tenant-a'),
    };

    const service = new StorefrontWebchatService(
      conversationRepository as never,
      publicWebchatSessionRepository as never,
      asyncTurnIntakeService as never,
      tenantContext as never,
    );

    await service.sendMessage({
      conversationId: 'conv-1',
      guestId: 'guest-1',
      text: 'Hola',
      attachments: [
        {
          assetType: 'image',
          fileName: 'foto.png',
          textContent: 'Foto del producto',
        },
      ],
      metadata: {
        page: '/checkout',
        source: 'composer',
      },
    });

    expect(asyncTurnIntakeService.acceptMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Adjuntos: Foto del producto'),
        metadata: expect.objectContaining({
          page: '/checkout',
          source: 'composer',
          attachments: [
            expect.objectContaining({
              assetType: 'image',
              fileName: 'foto.png',
              textContent: 'Foto del producto',
            }),
          ],
        }),
      }),
    );
  });
});
