import { ChatOrchestratorService } from '../src/modules/api/chat-orchestrator.service';

describe('ChatOrchestratorService', () => {
  it('runs the full flow and returns debug data', async () => {
    const traceLogService = {
      recordStage: jest.fn(async ({ stage, payload }) => ({
        id: `${stage}-log`,
        stage,
        payload,
      })),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-1',
      } as any,
      {
        findById: jest.fn(async () => null),
        createConversation: jest.fn(async () => ({ id: 'conv-1' })),
        appendMessage: jest.fn(async () => undefined),
        listRecent: jest.fn(async () => []),
      } as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      {
        getActivePrompt: jest.fn(async (key: string) => ({
          key,
          version: 1,
          template: `${key}-template`,
        })),
      } as any,
      {
        interpret: jest.fn(async () => ({
          intent: 'tenant.create_booking',
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Reservar mañana',
          },
        })),
      } as any,
      {
        normalize: jest.fn(() => ({
          intent: 'tenant.create_booking',
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Reservar mañana',
          },
          normalizedEntities: {
            dates: [
              {
                source: 'mañana',
                iso: '2026-04-04T12:00:00.000Z',
                precision: 'date',
              },
            ],
            measurements: [],
          },
        })),
      } as any,
      {
        decide: jest.fn(() => ({
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        })),
      } as any,
      {
        execute: jest.fn(async () => ({
          toolName: 'create_booking',
          payload: {
            bookingId: 'bk_1',
            status: 'confirmed',
          },
        })),
      } as any,
      {
        generateResponse: jest.fn(async () => 'Reserva confirmada'),
      } as any,
      {
        append: jest.fn(async () => undefined),
        getRecent: jest.fn(async () => []),
      } as any,
      traceLogService as any,
      {
        enqueueExtraction: jest.fn(),
      } as any,
    );

    const result = await service.handleMessage({
      message: 'Reservar mañana',
    });

    expect(result).toEqual(
      expect.objectContaining({
        conversationId: 'conv-1',
        traceId: 'trace-1',
        message: 'Reserva confirmada',
      }),
    );
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'response',
      }),
    );
  });
});
