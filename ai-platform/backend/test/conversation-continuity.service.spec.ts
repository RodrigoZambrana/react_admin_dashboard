import { ConversationSignalResolverService } from '../src/modules/conversation-signals/conversation-signal-resolver.service';
import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { ConversationContinuityService } from '../src/modules/continuity/conversation-continuity.service';

describe('ConversationContinuityService', () => {
  const noDocumentRetrieval = {
    attempted: false,
    reason: 'not_requested' as const,
    result: null,
  };

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
        new ConversationSignalResolverService(),
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

  it('keeps an open booking lane active even when a follow-up adds no new parseable facts yet', async () => {
    const { service } = createService({
      conversationId: 'conv-booking-open',
      lane: 'booking',
      lastIntent: 'CREATE_BOOKING',
      lastApprovedAction: null,
      lastApprovedToolName: null,
      approvedFacts: {
        requestSummary:
          'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
      },
      pendingFacts: {
        requestSummary:
          'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
      },
      missingFields: ['requested_date'],
      nextUsefulField: 'requested_date',
      lastApprovedResult: null,
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-booking-open',
      interpretation: {
        intent: 'CLARIFICATION',
        language: 'es',
        confidence: 0.24,
        entities: {
          rawMessage: 'sí',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.continuity).toEqual(
      expect.objectContaining({
        activeLane: 'booking',
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
      }),
    );
  });

  it('carries the most specific booking summary forward for fragmented scheduling turns', async () => {
    const { service } = createService({
      conversationId: 'conv-booking-summary',
      lane: 'booking',
      lastIntent: 'CREATE_BOOKING',
      lastApprovedAction: null,
      lastApprovedToolName: null,
      approvedFacts: {
        requestSummary:
          'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
      },
      pendingFacts: {
        requestSummary:
          'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
      },
      missingFields: ['requested_date'],
      nextUsefulField: 'requested_date',
      lastApprovedResult: null,
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-booking-summary',
      interpretation: {
        intent: 'CLARIFICATION',
        language: 'es',
        confidence: 0.44,
        entities: {
          rawMessage: 'mañana a las 11',
        },
        normalizedEntities: {
          dates: [
            {
              source: 'mañana a las 11',
              iso: '2026-04-04T11:00:00.000Z',
              precision: 'datetime',
            },
          ],
          measurements: [],
          dimensions: [],
        },
      },
    });

    expect(prepared.effectiveInterpretation.entities).toEqual(
      expect.objectContaining({
        rawMessage: 'mañana a las 11',
        requestSummary:
          'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
      }),
    );
    expect(prepared.effectiveInterpretation.normalizedEntities.dates).toEqual([
      expect.objectContaining({
        iso: '2026-04-04T11:00:00.000Z',
      }),
    ]);
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
      documentRetrieval: noDocumentRetrieval,
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
      documentRetrieval: noDocumentRetrieval,
    });

    expect(state).toBeNull();
    expect(repository.deleteByConversationId).toHaveBeenCalledWith('conv-5');
  });

  it('persists document exploration facts across grounded follow-up turns', async () => {
    const { service } = createService({
      conversationId: 'conv-doc',
      lane: 'document_exploration',
      lastIntent: 'GENERAL_CONVERSATION',
      lastApprovedAction: 'respond',
      lastApprovedToolName: null,
      approvedFacts: {
        activeDocumentIds: ['doc-1'],
        topicSummary: 'tela screen para cortinas roller',
      },
      pendingFacts: null,
      missingFields: [],
      nextUsefulField: null,
      lastApprovedResult: null,
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-doc',
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'es',
        confidence: 0.71,
        entities: {
          rawMessage: '¿y en colores más claros?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    const state = await service.persistTurnState({
      conversationId: 'conv-doc',
      preparedTurn: prepared,
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      execution: null,
      documentRetrieval: {
        attempted: true,
        reason: 'active_document_continuation',
        result: {
          source: 'document_origin',
          query: 'tela screen para cortinas roller. ¿y en colores más claros?',
          groundedSummary: 'El catálogo describe tonos claros para screen.',
          matches: [
            {
              documentId: 'doc-1',
              title: 'Catálogo roller',
              excerpt: 'Hay tonos claros para la tela screen.',
              sequence: 0,
              score: 3.2,
            },
          ],
        },
      },
    });

    expect(state).toEqual(
      expect.objectContaining({
        lane: 'document_exploration',
        lastApprovedAction: 'respond',
        approvedFacts: expect.objectContaining({
          activeDocumentIds: ['doc-1'],
        }),
      }),
    );
  });

  it('persists advisory exploration state across multi-turn recommendation flows', async () => {
    const { service } = createService({
      conversationId: 'conv-adv',
      lane: 'advisory_exploration',
      lastIntent: 'GENERAL_CONVERSATION',
      lastApprovedAction: 'respond',
      lastApprovedToolName: null,
      approvedFacts: {
        topicSummary: 'comparación entre opciones roller',
        preferenceSignals: ['más privacidad'],
      },
      pendingFacts: null,
      missingFields: [],
      nextUsefulField: null,
      lastApprovedResult: null,
      metadata: null,
      updatedAt: new Date('2026-04-03T20:00:00.000Z'),
    });

    const prepared = await service.prepareTurn({
      conversationId: 'conv-adv',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        confidence: 0.74,
        entities: {
          rawMessage: '¿y cuál me conviene más si quiero algo más privado?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
    });

    const state = await service.persistTurnState({
      conversationId: 'conv-adv',
      preparedTurn: prepared,
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'advisory_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      execution: null,
      documentRetrieval: noDocumentRetrieval,
    });

    expect(state).toEqual(
      expect.objectContaining({
        lane: 'advisory_exploration',
        lastApprovedAction: 'respond',
        approvedFacts: expect.objectContaining({
          topicSummary: expect.any(String),
        }),
      }),
    );
  });
});
