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

  it('carries quote facts forward after successful quote execution', async () => {
    const { service } = createService({
      conversationId: 'conv-quote',
      lane: 'quote',
      lastIntent: 'CREATE_QUOTE',
      lastApprovedAction: 'invoke_tool',
      lastApprovedToolName: 'create_quote',
      approvedFacts: {
        requestSummary: 'Necesito una cotizacion para puertas corredizas',
        measurements: [
          {
            source: '2 m',
            normalizedValue: 2,
            normalizedUnit: 'm',
            kind: 'length',
          },
        ],
      },
      pendingFacts: null,
      missingFields: [],
      nextUsefulField: null,
      lastApprovedResult: {
        quoteId: 'qt_123',
      },
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-quote',
      interpretation: {
        intent: 'CREATE_QUOTE',
        language: 'es',
        confidence: 0.77,
        entities: {
          rawMessage: 'ahora para 4 unidades',
          attendees: 4,
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.effectiveInterpretation.intent).toBe('CREATE_QUOTE');
    expect(prepared.effectiveInterpretation.entities).toEqual(
      expect.objectContaining({
        attendees: 4,
        requestSummary: 'ahora para 4 unidades',
      }),
    );
    expect(prepared.effectiveInterpretation.normalizedEntities.measurements).toEqual([
      expect.objectContaining({
        normalizedValue: 2,
        normalizedUnit: 'm',
      }),
    ]);
    expect(prepared.continuity).toEqual(
      expect.objectContaining({
        activeLane: 'quote',
        carriedFactKeys: ['measurements'],
      }),
    );
  });

  it('carries product facts forward after successful product execution', async () => {
    const { service } = createService({
      conversationId: 'conv-product',
      lane: 'product_lookup',
      lastIntent: 'GET_PRODUCT',
      lastApprovedAction: 'invoke_tool',
      lastApprovedToolName: 'get_product',
      approvedFacts: {
        sku: 'B-77',
        query: 'Beacon Desk Lamp',
      },
      pendingFacts: null,
      missingFields: [],
      nextUsefulField: null,
      lastApprovedResult: {
        sku: 'B-77',
      },
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-product',
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'es',
        confidence: 0.86,
        entities: {
          rawMessage: 'y el precio?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.effectiveInterpretation.intent).toBe('GET_PRODUCT');
    expect(prepared.effectiveInterpretation.entities).toEqual(
      expect.objectContaining({
        sku: 'B-77',
        productQuery: 'y el precio?',
      }),
    );
    expect(prepared.continuity).toEqual(
      expect.objectContaining({
        activeLane: 'product_lookup',
        carriedFactKeys: ['sku'],
      }),
    );
  });

  it('continues clarification state when the follow-up resolves the missing booking date', async () => {
    const { service } = createService({
      conversationId: 'conv-clarify',
      lane: 'booking',
      lastIntent: 'CREATE_BOOKING',
      lastApprovedAction: null,
      lastApprovedToolName: null,
      approvedFacts: null,
      pendingFacts: null,
      missingFields: ['requested_date'],
      nextUsefulField: 'requested_date',
      lastApprovedResult: null,
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-clarify',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        confidence: 0.48,
        entities: {
          rawMessage: 'manana',
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
          dimensions: [],
        },
      },
    });

    expect(prepared.effectiveInterpretation.intent).toBe('CREATE_BOOKING');
    expect(prepared.continuity).toEqual(
      expect.objectContaining({
        applied: true,
        activeLane: 'booking',
        nextUsefulField: 'requested_date',
      }),
    );
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
