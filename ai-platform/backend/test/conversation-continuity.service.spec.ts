import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { ConversationContinuityService } from '../src/modules/continuity/conversation-continuity.service';

describe('ConversationContinuityService', () => {
  function createService(record: Record<string, unknown> | null = null) {
    const repository = {
      findByConversationId: jest.fn(async () => record),
      save: jest.fn(async (input) => ({
        ...input,
        updatedAt: new Date('2026-04-03T20:00:00.000Z'),
      })),
      deleteByConversationId: jest.fn(async () => ({ count: 1 })),
    };

    return {
      repository,
      service: new ConversationContinuityService(
        repository as any,
        new PipelineLoggerService(),
      ),
    };
  }

  it('keeps continuity optional for general conversation turns', async () => {
    const { service } = createService();

    const prepared = await service.prepareTurn({
      conversationId: 'conv-1',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        confidence: 0.92,
        entities: {
          rawMessage: 'hola',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.previousState).toBeNull();
    expect(prepared.continuity).toEqual(
      expect.objectContaining({
        applied: false,
        activeLane: null,
        carriedFactKeys: [],
        missingFields: [],
      }),
    );
  });

  it('carries booking facts forward for ambiguous follow-up turns', async () => {
    const { service } = createService({
      conversationId: 'conv-2',
      lane: 'booking',
      lastIntent: 'CREATE_BOOKING',
      lastApprovedAction: 'invoke_tool',
      lastApprovedToolName: 'create_booking',
      approvedFacts: {
        requestedDate: {
          source: 'execution',
          iso: '2026-04-04T12:00:00.000Z',
          precision: 'date',
        },
      },
      pendingFacts: null,
      missingFields: [],
      nextUsefulField: null,
      lastApprovedResult: {
        bookingId: 'bk_123',
      },
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-2',
      interpretation: {
        intent: 'CLARIFICATION',
        language: 'es',
        confidence: 0.42,
        entities: {
          rawMessage: 'para 3 personas',
          attendees: 3,
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.effectiveInterpretation.intent).toBe('CREATE_BOOKING');
    expect(prepared.effectiveInterpretation.entities).toEqual(
      expect.objectContaining({
        attendees: 3,
      }),
    );
    expect(prepared.effectiveInterpretation.normalizedEntities.dates).toEqual([
      {
        source: 'execution',
        iso: '2026-04-04T12:00:00.000Z',
        precision: 'date',
      },
    ]);
    expect(prepared.continuity).toEqual(
      expect.objectContaining({
        applied: true,
        activeLane: 'booking',
        carriedFactKeys: ['requestedDate'],
      }),
    );
  });

  it('invalidates stale facts on explicit lane change', async () => {
    const { service } = createService({
      conversationId: 'conv-3',
      lane: 'booking',
      lastIntent: 'CREATE_BOOKING',
      lastApprovedAction: 'invoke_tool',
      lastApprovedToolName: 'create_booking',
      approvedFacts: {
        requestedDate: {
          source: 'execution',
          iso: '2026-04-04T12:00:00.000Z',
          precision: 'date',
        },
        attendees: 2,
      },
      pendingFacts: null,
      missingFields: [],
      nextUsefulField: null,
      lastApprovedResult: null,
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-3',
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'es',
        confidence: 0.91,
        entities: {
          rawMessage: 'quiero una lampara',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.activeState).toBeNull();
    expect(prepared.continuity.invalidatedFactKeys).toEqual(
      expect.arrayContaining(['requestedDate', 'attendees']),
    );
    expect(prepared.effectiveInterpretation.intent).toBe('GET_PRODUCT');
  });

  it('persists clarification state only when there is an actionable lane', async () => {
    const { service, repository } = createService();
    const prepared = await service.prepareTurn({
      conversationId: 'conv-4',
      interpretation: {
        intent: 'CREATE_BOOKING',
        language: 'es',
        confidence: 0.9,
        entities: {
          rawMessage: 'reservar',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    const state = await service.persistTurnState({
      conversationId: 'conv-4',
      preparedTurn: prepared,
      decision: {
        domain: 'core',
        action: 'clarify',
        reasonCode: 'booking_missing_fields',
        missingFields: ['requested_date'],
        responseTemplateKey: 'core.clarification',
      },
      execution: null,
    });

    expect(state).toEqual(
      expect.objectContaining({
        lane: 'booking',
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
      }),
    );
    expect(repository.save).toHaveBeenCalled();
  });

  it('clears state for non-task respond turns', async () => {
    const { service, repository } = createService();
    const prepared = await service.prepareTurn({
      conversationId: 'conv-5',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'en',
        confidence: 0.95,
        entities: {
          rawMessage: 'hello there',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    const state = await service.persistTurnState({
      conversationId: 'conv-5',
      preparedTurn: prepared,
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'general_conversation',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      execution: null,
    });

    expect(state).toBeNull();
    expect(repository.deleteByConversationId).toHaveBeenCalledWith('conv-5');
  });
});
