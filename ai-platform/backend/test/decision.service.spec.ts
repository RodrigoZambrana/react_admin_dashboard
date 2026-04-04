import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { ConversationSignalResolverService } from '../src/modules/conversation-signals/conversation-signal-resolver.service';
import { DecisionService } from '../src/modules/decision/decision.service';
import { TenantCapabilityRegistryService } from '../src/modules/tenant-capabilities/tenant-capability-registry.service';
import { ProductCatalogService } from '../src/modules/tools/product-catalog.service';

describe('DecisionService', () => {
  function createService(input?: {
    capabilities?: {
      booking?: boolean;
      quote?: boolean;
      product_catalog_lookup?: boolean;
      support_post_sale?: boolean;
    };
  }) {
    const capabilities = {
      booking: true,
      quote: true,
      product_catalog_lookup: true,
      support_post_sale: true,
      ...(input?.capabilities ?? {}),
    };

    return new DecisionService(
      new PipelineLoggerService(),
      new ProductCatalogService(),
      new ConversationSignalResolverService(),
      {
        resolveForCurrentTenant: () => ({
          tenantId: 'tenant-alpha',
          capabilities: {
            booking: {
              key: 'booking',
              enabled: capabilities.booking,
              description: '',
              intents: ['CREATE_BOOKING'],
              tools: ['create_booking'],
            },
            quote: {
              key: 'quote',
              enabled: capabilities.quote,
              description: '',
              intents: ['CREATE_QUOTE'],
              tools: ['create_quote'],
            },
            product_catalog_lookup: {
              key: 'product_catalog_lookup',
              enabled: capabilities.product_catalog_lookup,
              description: '',
              intents: ['GET_PRODUCT'],
              tools: ['get_product'],
            },
            support_post_sale: {
              key: 'support_post_sale',
              enabled: capabilities.support_post_sale,
              description: '',
              intents: ['GENERAL_CONVERSATION', 'CLARIFICATION'],
              tools: [],
            },
          },
          enabledKeys: Object.entries(capabilities)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key),
        }),
      } as unknown as TenantCapabilityRegistryService,
    );
  }

  it('routes valid booking requests to the booking tool', () => {
    const service = createService();

    const decision = service.decide({
      intent: 'CREATE_BOOKING',
      language: 'es',
      confidence: 0.9,
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
        dimensions: [],
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
      }),
    );
  });

  it('forces clarification when booking date is missing', () => {
    const service = createService();

    const decision = service.decide({
      intent: 'CREATE_BOOKING',
      language: 'en',
      confidence: 0.9,
      entities: {
        rawMessage: 'I need a booking',
      },
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'clarify',
        missingFields: ['requested_date'],
      }),
    );
  });

  it('continues continuity-prepared booking follow-ups without falling back to low-confidence clarification', () => {
    const service = createService();

    const decision = service.decide({
      intent: 'CREATE_BOOKING',
      language: 'es',
      confidence: 0.41,
      entities: {
        rawMessage: 'para 3 personas',
        attendees: 3,
      },
      normalizedEntities: {
        dates: [
          {
            source: 'continuity',
            iso: '2026-04-04T12:00:00.000Z',
            precision: 'date',
          },
        ],
        measurements: [],
        dimensions: [],
      },
      continuity: {
        applied: true,
        activeLane: 'booking',
        carriedFactKeys: ['requestedDate'],
        invalidatedFactKeys: [],
        missingFields: [],
        previousStateSummary: {
          lane: 'booking',
          missingFields: [],
          lastApprovedAction: 'invoke_tool',
        },
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
      }),
    );
  });

  it('uses continuity missing fields for low-confidence follow-up clarifications when the active lane remains open', () => {
    const service = createService();

    const decision = service.decide({
      intent: 'CLARIFICATION',
      language: 'es',
      confidence: 0.32,
      entities: {
        rawMessage: 'todavia no se',
      },
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
      continuity: {
        applied: false,
        activeLane: 'booking',
        carriedFactKeys: [],
        invalidatedFactKeys: [],
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
        previousStateSummary: {
          lane: 'booking',
          missingFields: ['requested_date'],
          nextUsefulField: 'requested_date',
          lastApprovedAction: 'clarify',
        },
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'clarify',
        reasonCode: 'continuity_missing_fields',
        missingFields: ['requested_date'],
      }),
    );
  });

  it('keeps a contextual follow-up in the active lane instead of resetting into generic clarification', () => {
    const service = createService();

    const decision = service.decide({
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        confidence: 0.52,
        entities: {
          rawMessage: 'Si me interesa',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
        continuity: {
          applied: true,
          activeLane: 'quote',
          carriedFactKeys: ['requestSummary'],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: {
            lane: 'quote',
            missingFields: [],
            lastApprovedAction: 'respond',
          },
        },
      } as any,
      conversationState: {
        conversationId: 'conv-follow-up',
        lane: 'quote',
        lastIntent: 'CREATE_QUOTE',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          requestSummary: 'Presupuesto para sustituir una ventana',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      documentRetrieval: null,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'respond',
        reasonCode: 'contextual_follow_up',
      }),
    );
  });

  it('keeps document-grounded follow-up turns in exploration instead of invoking product lookup', () => {
    const service = createService();

    const decision = service.decide({
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'es',
        confidence: 0.78,
        entities: {
          rawMessage: 'y en colores más claros?',
          productQuery: 'y en colores más claros?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
        continuity: {
          applied: true,
          activeLane: 'document_exploration',
          carriedFactKeys: ['activeDocumentIds', 'topicSummary'],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: {
            lane: 'document_exploration',
          },
        },
      } as any,
      conversationState: {
        conversationId: 'conv-doc',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          activeDocumentIds: ['doc-1'],
          topicSummary: 'colores y opciones de cortinas roller',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      documentRetrieval: {
        attempted: true,
        reason: 'active_document_continuation',
        result: {
          source: 'document_origin',
          query: 'colores y opciones de cortinas roller. y en colores más claros?',
          groundedSummary: 'El catálogo describe varias telas y colores claros.',
          matches: [],
        },
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
      }),
    );
  });

  it('keeps advisory follow-up turns active instead of resetting to a generic response', () => {
    const service = createService();

    const decision = service.decide({
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        confidence: 0.67,
        entities: {
          rawMessage: '¿y cuál me conviene más si quiero algo más privado?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
        continuity: {
          applied: true,
          activeLane: 'advisory_exploration',
          carriedFactKeys: ['topicSummary', 'preferenceSignals'],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: {
            lane: 'advisory_exploration',
          },
        },
      } as any,
      conversationState: {
        conversationId: 'conv-adv',
        lane: 'advisory_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          topicSummary: 'comparación entre opciones roller',
          preferenceSignals: ['más privacidad'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      documentRetrieval: null,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'respond',
        reasonCode: 'advisory_exploration',
      }),
    );
  });

  it('uses product lookup only when there is a grounded catalog match', () => {
    const service = createService();

    const decision = service.decide({
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'en',
        confidence: 0.84,
        entities: {
          rawMessage: 'I need the Beacon Desk Lamp',
          productQuery: 'Beacon Desk Lamp',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
      documentRetrieval: null,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'get_product',
      }),
    );
  });

  it('does not route to a disabled tenant capability even when the intent matches', () => {
    const service = createService({
      capabilities: {
        product_catalog_lookup: false,
      },
    });

    const decision = service.decide({
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'en',
        confidence: 0.84,
        entities: {
          rawMessage: 'I need the Beacon Desk Lamp',
          productQuery: 'Beacon Desk Lamp',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
      documentRetrieval: null,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'respond',
        reasonCode: 'product_lookup_capability_disabled',
      }),
    );
  });

  it('closes the turn contextually for gratitude after a completed flow instead of reopening a generic prompt', () => {
    const service = createService();

    const decision = service.decide({
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        confidence: 0.74,
        entities: {
          rawMessage: 'Gracias por la ayuda',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-closed',
        lane: 'booking',
        lastIntent: 'CREATE_BOOKING',
        lastApprovedAction: 'invoke_tool',
        lastApprovedToolName: 'create_booking',
        approvedFacts: {
          requestedDate: {
            iso: '2026-04-05T11:00:00.000Z',
            precision: 'date',
            source: 'execution',
          },
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: {
          bookingId: 'bk_1',
          scheduledFor: '2026-04-05T11:00:00.000Z',
          status: 'confirmed',
        },
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
      documentRetrieval: {
        attempted: true,
        reason: 'active_document_continuation',
        result: {
          source: 'document_origin',
          query: 'cambio de cadena roller',
          groundedSummary: 'Servicio estándar.',
          matches: [],
        },
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'close_turn',
        reasonCode: 'contextual_close_acknowledged',
      }),
    );
  });

  it('does not close the turn when gratitude also contains a fresh request', () => {
    const service = createService();

    const decision = service.decide({
      interpretation: {
        intent: 'CREATE_BOOKING',
        language: 'es',
        confidence: 0.88,
        entities: {
          rawMessage: 'Gracias, agendame una visita para mañana',
        },
        normalizedEntities: {
          dates: [
            {
              source: 'mañana',
              iso: '2026-04-05T12:00:00.000Z',
              precision: 'date',
            },
          ],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-open',
        lane: 'booking',
        lastIntent: 'CREATE_BOOKING',
        lastApprovedAction: 'clarify',
        missingFields: ['requested_date'],
        updatedAt: '2026-04-04T10:00:00.000Z',
      } as any,
      documentRetrieval: null,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
      }),
    );
  });
});
