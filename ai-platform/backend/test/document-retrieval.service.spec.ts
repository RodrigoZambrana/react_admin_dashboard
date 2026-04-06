import { ConversationSignalResolverService } from '../src/modules/conversation-signals/conversation-signal-resolver.service';
import { DocumentRetrievalService } from '../src/modules/documents/document-retrieval.service';
import { readBackendSource } from './support/project-paths';

describe('DocumentRetrievalService', () => {
  it('retrieves document-origin knowledge from active uploaded chunks', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          sequence: 0,
          content:
            'El cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
          searchText:
            'el cambio de cadena de cortinas roller esta cubierto dentro del servicio estandar',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-1',
            title: 'Cobertura Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: '¿Qué dice el documento sobre el cambio de cadena de una roller?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage:
            '¿Qué dice el documento sobre el cambio de cadena de una roller?',
        },
        language: 'es',
        confidence: 0.9,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result).toEqual({
      attempted: true,
      reason: 'document_query',
      result: expect.objectContaining({
        source: 'document_origin',
        groundedSummary: expect.stringMatching(/cambio de cadena/i),
        matches: [
          expect.objectContaining({
            documentId: 'doc-1',
            title: 'Cobertura Roller',
          }),
        ],
      }),
    });
  });

  it('retrieves approved knowledge for eligible advisory turns without explicit document cue wording', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-roller-1',
          documentId: 'doc-roller',
          sequence: 0,
          content:
            'Tipos de Cortinas de Enrollar. Disponibles en PVC y Aluminio, con opciones manuales o motorizadas.',
          searchText:
            'tipos de cortinas de enrollar disponibles en pvc y aluminio con opciones manuales o motorizadas',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-roller',
            title: 'Catálogo Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Necesito información de cortinas de enrollar',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Necesito información de cortinas de enrollar',
        },
        language: 'es',
        confidence: 0.88,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          source: 'document_origin',
          groundedSummary: expect.stringMatching(/PVC y Aluminio/i),
        }),
      }),
    );
  });

  it('can ground a response from normalized propositions when no typed claim is available', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-prop-1',
          documentId: 'doc-prop',
          sequence: 0,
          content: 'Serie 25. No soporta DVH.',
          searchText: 'serie 25 no soporta dvh',
          retrievalProjection: 'serie 25 feature support dvh no soporta',
          metadata: {
            section: 'SERIE 25',
            supportSummary: {
              topic: 'SERIE 25',
              supportedAxes: [],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-06T10:00:00.000Z'),
          document: {
            id: 'doc-prop',
            title: 'Aberturas',
            updatedAt: new Date('2026-04-06T10:00:00.000Z'),
          },
          knowledgeItems: [],
          propositions: [
            {
              predicate: 'feature_support',
              facet: null,
              objectValue: 'DVH',
              objectNormalized: 'dvh',
              polarity: 'NEGATED',
              supportClass: 'EXPLICIT_FACT',
              evidenceTier: 'NORMALIZED_PROPOSITION',
              confidence: 0.92,
              relationScope: [],
              metadata: {
                extractionScope: 'tenant_only',
                profileKey: 'product_catalog',
                claim: {
                  axis: 'feature_support',
                  layer: 'factual',
                  subject: {
                    axis: 'product_type',
                    value: 'SERIE 25',
                    normalizedValue: 'serie 25',
                  },
                },
              },
              patternKey: 'feature_support||negated|subject:product_type|scopes:',
              canonicalKey: 'feature-support-serie-25-dvh',
              promotionState: 'UNCLASSIFIED',
              promotedAxis: null,
              promotedFacet: null,
              evidenceTextSpan: 'No soporta DVH.',
            },
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'la serie 25 soporta dvh?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'la serie 25 soporta dvh?',
        },
        language: 'es',
        confidence: 0.92,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.groundedSummary).toMatch(/dvh/i);
    expect(result.result?.matches[0]?.supportSummary?.evidenceTier).toBe(
      'normalized_proposition',
    );
    expect(
      result.result?.matches[0]?.supportSummary?.propositionSummaries,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicate: 'feature_support',
          polarity: 'negated',
          objectValue: 'DVH',
        }),
      ]),
    );
  });

  it('prefers factual master chunks over a newer operational guide for factual queries', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-guide-1',
          documentId: 'doc-guide',
          sequence: 0,
          content:
            'Si la consulta es informativa, primero explicamos el producto y no pasamos directo a cotización.',
          searchText:
            'si la consulta es informativa primero explicamos el producto y no pasamos directo a cotizacion',
          metadata: {
            usageBoundary: 'operational',
          },
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-guide',
            title: 'Documento Guia Nuevo',
            metadata: {
              documentRole: 'operational_guide',
              documentLayers: ['workflow', 'guidance'],
            },
            updatedAt: new Date('2026-04-05T20:00:00.000Z'),
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'informative_flow',
              valueText: 'primero explicamos el producto',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan:
                'Si la consulta es informativa, primero explicamos el producto.',
              metadata: {
                claim: {
                  axis: 'informative_flow',
                  kind: 'guidance_signal',
                  layer: 'guidance',
                  values: ['primero explicamos el producto'],
                },
              },
            },
          ],
        },
        {
          id: 'chunk-master-1',
          documentId: 'doc-master',
          sequence: 0,
          content: 'No contamos con local comercial. Nuestra atención es principalmente online.',
          searchText:
            'no contamos con local comercial nuestra atencion es principalmente online',
          metadata: {
            usageBoundary: 'knowledge',
          },
          createdAt: new Date('2026-04-05T18:00:00.000Z'),
          document: {
            id: 'doc-master',
            title: 'Documento Maestro Anterior',
            metadata: {
              documentRole: 'factual_master',
              documentLayers: ['factual'],
            },
            updatedAt: new Date('2026-04-05T18:00:00.000Z'),
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'service_offers',
              valueText: 'atencion online',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan:
                'No contamos con local comercial. Nuestra atención es principalmente online.',
              metadata: {
                claim: {
                  axis: 'service_offers',
                  kind: 'relational_fact',
                  values: ['atencion online'],
                },
              },
            },
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'tienen local comercial?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'tienen local comercial?',
        },
        language: 'es',
        confidence: 0.92,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.matches).toEqual([
      expect.objectContaining({
        documentId: 'doc-master',
        title: 'Documento Maestro Anterior',
      }),
    ]);
    expect(result.result?.groundedSummary).toMatch(/local comercial/i);
    expect(result.result?.matches.some((match) => match.documentId === 'doc-guide')).toBe(
      false,
    );
  });

  it('pivots thin focus follow-ups toward the current detail request instead of carrying the previous payment topic', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-local',
          documentId: 'doc-master',
          sequence: 0,
          content:
            'No contamos con local comercial. Brindamos asesoramiento personalizado y coordinación de visitas.',
          searchText:
            'no contamos con local comercial brindamos asesoramiento personalizado y coordinacion de visitas',
          metadata: null,
          createdAt: new Date('2026-04-06T10:00:00.000Z'),
          document: {
            id: 'doc-master',
            title: 'Documento Maestro',
            updatedAt: new Date('2026-04-06T10:00:00.000Z'),
          },
        },
        {
          id: 'chunk-payments',
          documentId: 'doc-master',
          sequence: 1,
          content: 'Aceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas.',
          searchText:
            'aceptamos transferencia bancaria efectivo mercado pago y tarjetas',
          metadata: null,
          createdAt: new Date('2026-04-06T10:00:00.000Z'),
          document: {
            id: 'doc-master',
            title: 'Documento Maestro',
            updatedAt: new Date('2026-04-06T10:00:00.000Z'),
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'tiene local para ver el producto?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'tiene local para ver el producto?',
          productQuery: 'cortina enrollar aluminio',
          requestSummary: 'Consulta sobre local para ver cortina enrollar aluminio',
        },
        language: 'es',
        confidence: 0.9,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-local-follow-up',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'cortina de enrollar de aluminio',
          topicSummary: 'Consulta sobre formas de pago y garantía para cortinas de enrollar de aluminio',
          lastDocumentQuery:
            'Consulta sobre formas de pago y garantía para cortinas de enrollar de aluminio',
          activeDocumentIds: ['doc-master'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-06T10:00:00.000Z',
      },
    });

    expect(result.result?.query).toMatch(/local/i);
    expect(result.result?.query).not.toMatch(/formas de pago|garant/i);
    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        excerpt: expect.stringMatching(/no contamos con local comercial/i),
      }),
    );
  });

  it('keeps the recent topic for short follow-up knowledge turns before the document lane is fully locked', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-roller-2',
          documentId: 'doc-roller',
          sequence: 1,
          content:
            'Las cortinas de enrollar están disponibles en PVC y aluminio, con opciones manuales o motorizadas.',
          searchText:
            'las cortinas de enrollar estan disponibles en pvc y aluminio con opciones manuales o motorizadas',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-roller',
            title: 'Catálogo Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: '¿Qué tipos tienen?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: '¿Qué tipos tienen?',
        },
        language: 'es',
        confidence: 0.83,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-follow-up',
        lane: 'advisory_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          topicSummary: 'cortinas de enrollar',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          query: expect.stringMatching(/cortinas de enrollar/i),
          groundedSummary: expect.stringMatching(/PVC y aluminio/i),
        }),
      }),
    );
  });

  it('pivots away from the previous payment query when a new visit-cost subject is explicit', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-payment',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            'Trabajamos con Mercado Pago en cuotas, transferencia bancaria, efectivo y tarjetas.',
          searchText:
            'trabajamos con mercado pago en cuotas transferencia bancaria efectivo y tarjetas',
          metadata: null,
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-visit',
          documentId: 'doc-maestro',
          sequence: 1,
          content:
            'En Montevideo podemos coordinar visitas comerciales y técnicas según el tipo de trabajo. Las visitas dentro de Montevideo son sin costo. Fuera de Montevideo puede corresponder costo de traslado.',
          searchText:
            'montevideo coordinar visitas comerciales tecnicas tipo trabajo visitas dentro montevideo sin costo fuera montevideo puede corresponder costo de traslado',
          metadata: {
            supportSummary: {
              topic: 'VISITAS, RECTIFICACION Y MUESTRAS',
              supportedAxes: ['commercial_visit_cost', 'travel_cost_responsibility'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'commercial_visit_cost',
              valueText: 'sin costo',
              normalizedValue: 'sin costo',
              supportClass: 'EXPLICIT_FACT',
              metadata: {
                claim: {
                  axis: 'commercial_visit_cost',
                  kind: 'relational_fact',
                  values: ['sin costo'],
                  appliesTo: [
                    {
                      axis: 'location',
                      value: 'Montevideo',
                      normalizedValue: 'montevideo',
                    },
                  ],
                },
              },
            },
            {
              kind: 'CLAIM',
              label: 'travel_cost_responsibility',
              valueText: 'a cargo del cliente',
              normalizedValue: 'a cargo del cliente',
              supportClass: 'PARTIAL_FACT',
              metadata: {
                claim: {
                  axis: 'travel_cost_responsibility',
                  kind: 'coverage_gap',
                  values: ['a cargo del cliente'],
                },
              },
            },
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'hacen visitas a domicilio para toma de medidas? que costo tiene?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'hacen visitas a domicilio para toma de medidas? que costo tiene?',
          productQuery: 'visita a domicilio para toma de medidas',
          requestSummary:
            'Consulta sobre visita a domicilio para toma de medidas y su costo',
        },
        language: 'es',
        confidence: 0.91,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-visit-cost',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'formas de pago con Mercado Pago',
          topicSummary: 'formas de pago con Mercado Pago',
          lastDocumentQuery: 'formas de pago con Mercado Pago',
          activeDocumentIds: ['doc-maestro'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T20:00:00.000Z',
      },
    });

    expect(result.result?.query).not.toMatch(/mercado pago/i);
    expect(result.result?.query).toMatch(/visita|toma de medidas|costo/i);
    expect(result.result?.groundedSummary).toMatch(/sin costo|traslado/i);
    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        excerpt: expect.stringMatching(/visitas dentro de Montevideo son sin costo/i),
      }),
    );
  });

  it('retrieves knowledge for an informational visit question even when interpretation was labeled CREATE_BOOKING', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-visit-info',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            'Sí, coordinamos visitas a domicilio para tomar medidas. En Montevideo las visitas son sin costo.',
          searchText:
            'si coordinamos visitas a domicilio para tomar medidas en montevideo las visitas son sin costo',
          metadata: null,
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'service_offers',
              value: 'visitas a domicilio para tomar medidas',
            }),
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'toman medidas a domicilio? me encuentro en montevideo',
      interpretation: {
        intent: 'CREATE_BOOKING',
        entities: {
          rawMessage: 'toman medidas a domicilio? me encuentro en montevideo',
          requestSummary:
            'Consulta sobre toma de medidas a domicilio para reemplazo en Montevideo',
          productQuery: 'reemplazo de cortina de enrollar de madera por una de pvc',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-booking-info-doc',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'reemplazo cortina enrollar pvc',
          topicSummary: 'reemplazo cortina enrollar pvc',
        },
        missingFields: [],
        updatedAt: '2026-04-04T10:00:00.000Z',
      } as any,
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          groundedSummary: expect.stringMatching(/visitas?.*domicilio|montevideo.*sin costo/i),
        }),
      }),
    );
  });

  it('retrieves knowledge for an informational follow-up inside a stale booking lane', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-visit-follow-up',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            'Sí, coordinamos visitas a domicilio para tomar medidas según el trabajo.',
          searchText:
            'si coordinamos visitas a domicilio para tomar medidas segun el trabajo',
          metadata: null,
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'service_offers',
              value: 'visitas a domicilio para tomar medidas',
            }),
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'solo quiero saber si toman medidas a domicilio',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'solo quiero saber si toman medidas a domicilio',
          requestSummary: 'Consulta sobre toma de medidas a domicilio',
          productQuery: 'cortina de enrollar de pvc',
        },
        language: 'es',
        confidence: 0.95,
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
          },
        },
      } as any,
      conversationState: {
        conversationId: 'conv-booking-info-follow-up',
        lane: 'booking',
        lastIntent: 'CREATE_BOOKING',
        lastApprovedAction: 'clarify',
        approvedFacts: {
          requestSummary:
            'Consulta sobre toma de medidas a domicilio para reemplazo de cortina de enrollar de madera por una de PVC en Montevideo',
        },
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
        updatedAt: '2026-04-04T10:00:00.000Z',
      } as any,
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          groundedSummary: expect.stringMatching(/visitas?.*domicilio|tomar medidas/i),
        }),
      }),
    );
  });

  it('retrieves knowledge for a short location follow-up that was misclassified as booking', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-visit-montevideo',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            'Sí, coordinamos visitas a domicilio para tomar medidas. Dentro de Montevideo las visitas son sin costo.',
          searchText:
            'si coordinamos visitas a domicilio para tomar medidas dentro de montevideo las visitas son sin costo',
          metadata: null,
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'service_offers',
              value: 'visitas a domicilio para tomar medidas',
            }),
            buildClaimKnowledgeItem({
              axis: 'commercial_visit_cost',
              value: 'sin costo',
              appliesTo: [{ axis: 'location', value: 'Montevideo' }],
            }),
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'me encuentro en montevideo',
      interpretation: {
        intent: 'CREATE_BOOKING',
        entities: {
          rawMessage: 'me encuentro en montevideo',
          requestSummary:
            'Consulta sobre toma de medidas a domicilio para reemplazo en Montevideo',
          productQuery: 'reemplazo de cortina de enrollar de madera por una de pvc',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-booking-location-follow-up',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'reemplazo cortina enrollar pvc',
          topicSummary: 'toman medidas a domicilio',
        },
        missingFields: [],
        updatedAt: '2026-04-04T10:00:00.000Z',
      } as any,
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          groundedSummary: expect.stringMatching(/visitas?.*montevideo|sin costo/i),
        }),
      }),
    );
  });

  it('prioritizes service-capability evidence over product alias chunks for service questions on the same subject', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-product-alias',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            '- persiana PVC\n- cortina de enrollar PVC\n- persiana exterior PVC\n- Catalana de PVC',
          searchText:
            'persiana pvc cortina de enrollar pvc persiana exterior pvc catalana de pvc',
          metadata: {
            section: '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
            supportSummary: {
              topic: 'Alias útiles',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'materials',
              value: 'PVC',
              subject: {
                axis: 'section_topic',
                value: 'PERSIANA O CORTINA DE ENROLLAR',
              },
              appliesTo: [{ axis: 'material', value: 'PVC' }],
            }),
          ],
        },
        {
          id: 'chunk-service-visit',
          documentId: 'doc-maestro',
          sequence: 1,
          content:
            'Sí, coordinamos visitas a domicilio para tomar medidas. En Montevideo las visitas son sin costo.',
          searchText:
            'si coordinamos visitas a domicilio para tomar medidas en montevideo las visitas son sin costo',
          metadata: {
            section: 'VISITAS, RECTIFICACION Y MUESTRAS',
            supportSummary: {
              topic: 'Visita previa',
              supportedAxes: ['service_offers', 'commercial_visit_cost'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'service_offers',
              value: 'visitas a domicilio para tomar medidas',
              subject: {
                axis: 'section_topic',
                value: 'VISITAS',
              },
            }),
            buildClaimKnowledgeItem({
              axis: 'commercial_visit_cost',
              value: 'sin costo',
              appliesTo: [{ axis: 'location', value: 'Montevideo' }],
            }),
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'toman meididas a domicilio? me encuentro en montevideo',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'toman meididas a domicilio? me encuentro en montevideo',
          productQuery: 'cortina de enrollar de pvc',
          requestSummary:
            'Consulta sobre toma de medidas a domicilio para cortina de enrollar de pvc en Montevideo',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
        continuity: {
          applied: true,
          activeLane: 'document_exploration',
          carriedFactKeys: ['activeDocumentIds', 'lastDocumentQuery'],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: {
            lane: 'document_exploration',
            missingFields: [],
            lastApprovedAction: 'respond',
          },
        },
      } as any,
      conversationState: {
        conversationId: 'conv-service-priority',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          activeDocumentIds: ['doc-maestro'],
          subjectSummary: 'cortina de enrollar de pvc',
          topicSummary: 'reemplazo cortina enrollar pvc',
          lastDocumentQuery: 'reemplazo cortina enrollar pvc',
        },
        missingFields: [],
        updatedAt: '2026-04-04T10:00:00.000Z',
      } as any,
    });

    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        excerpt: expect.stringMatching(/visitas?.*domicilio|sin costo/i),
      }),
    );
    expect(result.result?.groundedSummary).toMatch(/visitas?.*domicilio|sin costo/i);
  });

  it('does not let quote_fields dominate a service-capability question about home measurements', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-aberturas-quote-fields',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            '- tipo de abertura: corredizas, batientes, oscilobatientes\n- ancho y alto aproximado\n- si es recambio o instalación nueva',
          searchText:
            'tipo de abertura corredizas batientes oscilobatientes ancho y alto aproximado si es recambio o instalacion nueva',
          metadata: {
            section: '12. ABERTURAS EN ALUMINIO',
            supportSummary: {
              topic: 'Datos útiles para presupuesto',
              supportedAxes: ['quote_fields'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildMetadataKnowledgeItem({
              axis: 'quote_fields',
              value:
                'tipo de abertura: corredizas, batientes, oscilobatientes; ancho y alto aproximado',
              layer: 'workflow',
              subject: {
                axis: 'section_topic',
                value: 'ABERTURAS',
              },
              appliesTo: [{ axis: 'material', value: 'ALUMINIO' }],
            }),
          ],
        },
        {
          id: 'chunk-visit-organic',
          documentId: 'doc-maestro',
          sequence: 1,
          content:
            'Sí, podemos coordinar una primera visita para mostrarte el producto y rectificar medidas antes de definir el trabajo final.',
          searchText:
            'si podemos coordinar una primera visita para mostrarte el producto y rectificar medidas antes de definir el trabajo final',
          metadata: {
            section: '15. RESPUESTAS ORGANICAS PARA SITUACIONES FRECUENTES',
            supportSummary: {
              topic: 'Visita previa',
              supportedAxes: ['organic_response_pattern'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-06T00:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            buildMetadataKnowledgeItem({
              axis: 'organic_response_pattern',
              value:
                'Sí, podemos coordinar una primera visita para mostrarte el producto y rectificar medidas antes de definir el trabajo final.',
              layer: 'guidance',
              subject: {
                axis: 'section_topic',
                value: 'Visita previa',
              },
            }),
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'toman medidas a domicilio?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'toman medidas a domicilio?',
          requestSummary: 'Consulta sobre toma de medidas a domicilio',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-home-measure-service',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'medidas a domicilio',
          topicSummary: 'medidas a domicilio',
        },
        missingFields: [],
        updatedAt: '2026-04-04T10:00:00.000Z',
      } as any,
    });

    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        excerpt: expect.stringMatching(/primera visita|rectificar medidas/i),
      }),
    );
  });

  it('locks retrieval to warranty evidence when the user asks for guarantee details', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-modes',
          documentId: 'doc-maestro',
          sequence: 0,
          content: 'Las cortinas de enrollar pueden ser manuales o motorizadas.',
          searchText:
            'las cortinas de enrollar pueden ser manuales o motorizadas',
          metadata: {
            supportSummary: {
              topic: 'PERSIANAS Y CORTINAS DE ENROLLAR / Accionamiento',
              supportedAxes: ['operation_modes'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'operation_modes',
              valueText: 'manuales | motorizadas',
              normalizedValue: 'manuales motorizadas',
              supportClass: 'EXPLICIT_FACT',
              metadata: {
                claim: {
                  axis: 'operation_modes',
                  kind: 'relational_fact',
                  values: ['manuales', 'motorizadas'],
                  subject: {
                    axis: 'section_topic',
                    value: 'cortinas de enrollar',
                    normalizedValue: 'cortinas de enrollar',
                  },
                },
              },
            },
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-warranty',
          documentId: 'doc-maestro',
          sequence: 1,
          content:
            'La garantía depende del producto. En varias líneas de aluminio y roller trabajamos con 2 años, y en distintas opciones de PVC la referencia habitual es 1 año.',
          searchText:
            'garantia depende producto lineas aluminio roller trabajamos con 2 anos pvc referencia habitual 1 ano',
          metadata: {
            supportSummary: {
              topic: 'GARANTIAS',
              supportedAxes: ['warranty_terms'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'warranty_terms',
              valueText: '2 años',
              normalizedValue: '2 anos',
              supportClass: 'EXPLICIT_FACT',
              metadata: {
                claim: {
                  axis: 'warranty_terms',
                  kind: 'relational_fact',
                  values: ['2 años'],
                  subject: {
                    axis: 'section_topic',
                    value: 'cortinas de enrollar',
                    normalizedValue: 'cortinas de enrollar',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'ALUMINIO',
                      normalizedValue: 'aluminio',
                    },
                  ],
                },
              },
            },
            {
              kind: 'CLAIM',
              label: 'warranty_terms',
              valueText: '1 año',
              normalizedValue: '1 ano',
              supportClass: 'EXPLICIT_FACT',
              metadata: {
                claim: {
                  axis: 'warranty_terms',
                  kind: 'relational_fact',
                  values: ['1 año'],
                  subject: {
                    axis: 'section_topic',
                    value: 'cortinas de enrollar',
                    normalizedValue: 'cortinas de enrollar',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'PVC',
                      normalizedValue: 'pvc',
                    },
                  ],
                },
              },
            },
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'que garantia tienen las cortinas de enrollar?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'que garantia tienen las cortinas de enrollar?',
          productQuery: 'cortinas de enrollar',
          requestSummary: 'Consulta sobre garantía de cortinas de enrollar',
        },
        language: 'es',
        confidence: 0.92,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.query).toMatch(/garantia|garantía/i);
    expect(result.result?.groundedSummary).toMatch(/2 años|1 año|garantía/i);
    expect(result.result?.groundedSummary).not.toMatch(/manuales|motorizadas/i);
    expect(result.result?.matches[0]?.supportSummary?.supportedAxes).toContain(
      'warranty_terms',
    );
  });

  it('prioritizes service and viability evidence over raw material facts for replacement-work questions', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-pvc-material',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            'La persiana de enrollar en PVC es liviana, funcional y viene en color blanco.',
          searchText:
            'persiana enrollar pvc liviana funcional color blanco',
          retrievalProjection:
            'persiana enrollar pvc funcional color blanco material pvc',
          metadata: {
            supportSummary: {
              topic: '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
              supportedAxes: ['materials', 'color_options'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'materials',
              value: 'PVC',
              subject: {
                axis: 'section_topic',
                value: 'PERSIANA O CORTINA DE ENROLLAR',
                normalizedValue: 'persiana o cortina de enrollar',
              },
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-replacement-service',
          documentId: 'doc-maestro',
          sequence: 1,
          content:
            'Sí, hacemos recambio de persianas viejas de madera por nuevas en PVC o aluminio según el caso.',
          searchText:
            'hacemos recambio persianas viejas madera nuevas pvc aluminio segun el caso',
          retrievalProjection:
            'recambio reemplazo persianas madera pvc aluminio hacemos ese trabajo',
          metadata: {
            supportSummary: {
              topic: '7. PERSIANAS Y CORTINAS DE ENROLLAR / Reemplazo',
              supportedAxes: ['service_offers'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'service_offers',
              value: 'recambio de persianas viejas',
              subject: {
                axis: 'section_topic',
                value: 'PERSIANAS Y CORTINAS DE ENROLLAR',
                normalizedValue: 'persianas y cortinas de enrollar',
              },
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:01.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message:
        'hola busco reemplazar una cortina de enrollar de madera por una de pvc hacen ese tipo de trabajo?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage:
            'hola busco reemplazar una cortina de enrollar de madera por una de pvc hacen ese tipo de trabajo?',
          productQuery: 'reemplazar cortina de enrollar de madera por una de pvc',
          requestSummary:
            'Consulta si realizan recambio o reemplazo de una cortina de enrollar de madera por una de PVC',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        sequence: 1,
      }),
    );
    expect(result.result?.groundedSummary).toMatch(/recambio|reemplazo|madera|pvc/i);
    expect(result.result?.groundedSummary).not.toMatch(
      /^Materiales\s*\(/i,
    );
  });

  it('keeps the active subject when an additive follow-up refines the same product family', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-exterior-1',
          documentId: 'doc-exterior',
          sequence: 0,
          content:
            'Las cortinas de enrollar exteriores están disponibles en PVC y aluminio.',
          searchText:
            'las cortinas de enrollar exteriores estan disponibles en pvc y aluminio',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-exterior',
            title: 'Enrollar Exteriores',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'también tienen cortinas de enrollar exteriores?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'también tienen cortinas de enrollar exteriores?',
        },
        language: 'es',
        confidence: 0.84,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-exterior',
        lane: 'advisory_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          subjectSummary: 'cortinas de enrollar',
          topicSummary: 'cortinas de enrollar',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          query: expect.stringMatching(/cortinas de enrollar/i),
          groundedSummary: expect.stringMatching(/PVC y aluminio/i),
        }),
      }),
    );
  });

  it('inherits the active subject for short material follow-ups without depending on lexical overlap alone', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-materials-1',
          documentId: 'doc-materials',
          sequence: 0,
          content:
            'Las cortinas de enrollar exteriores están disponibles en PVC y aluminio.',
          searchText:
            'las cortinas de enrollar exteriores estan disponibles en pvc y aluminio',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-materials',
            title: 'Enrollar Exteriores',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'en qué materiales',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'en qué materiales',
        },
        language: 'es',
        confidence: 0.8,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-materials',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          subjectSummary: 'cortinas de enrollar exteriores',
          topicSummary: 'cortinas de enrollar exteriores',
          activeDocumentIds: ['doc-materials'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'active_document_continuation',
        result: expect.objectContaining({
          query: expect.stringMatching(/cortinas de enrollar exteriores/i),
          groundedSummary: expect.stringMatching(/PVC y aluminio/i),
        }),
      }),
    );
  });

  it('prefers a refreshed explicit subject over the previous follow-up topic when the user pivots to a nearby product family', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-guidance-1',
          documentId: 'doc-enrollar',
          sequence: 0,
          content:
            'Datos útiles para presupuesto: tipo de roller, ancho y alto aproximado, cantidad y ambiente.',
          searchText:
            'datos utiles para presupuesto tipo de roller ancho y alto aproximado cantidad y ambiente',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Enrollar Operativo',
          },
        },
        {
          id: 'chunk-enrollar-1',
          documentId: 'doc-enrollar',
          sequence: 1,
          content:
            'Las cortinas de enrollar están disponibles en PVC y aluminio, y pueden ser manuales o motorizadas.',
          searchText:
            'las cortinas de enrollar estan disponibles en pvc y aluminio y pueden ser manuales o motorizadas',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Enrollar',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Y cortinas de enrollar?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Y cortinas de enrollar?',
          productQuery: 'cortinas de enrollar',
          requestSummary: 'Consulta sobre cortinas de enrollar',
        },
        language: 'es',
        confidence: 0.85,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-nearby-family',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          subjectSummary: 'cortinas roller blackout',
          topicSummary: 'cortinas roller blackout',
          activeDocumentIds: ['doc-enrollar'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'active_document_continuation',
        result: expect.objectContaining({
          query: expect.stringMatching(/cortinas de enrollar/i),
          groundedSummary: expect.stringMatching(/PVC y aluminio/i),
        }),
      }),
    );
    expect(result.result?.groundedSummary).not.toMatch(/presupuesto/i);
  });

  it('replaces the previous nearby product family even without a productQuery entity when the new subject is clearer', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-enrollar-raw-1',
          documentId: 'doc-enrollar-raw',
          sequence: 0,
          content:
            'Las cortinas de enrollar están disponibles en PVC y aluminio, y pueden ser manuales o motorizadas.',
          searchText:
            'las cortinas de enrollar estan disponibles en pvc y aluminio y pueden ser manuales o motorizadas',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-enrollar-raw',
            title: 'Enrollar',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Y cortinas de enrollar?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Y cortinas de enrollar?',
          requestSummary: 'cortinas de enrollar',
        },
        language: 'es',
        confidence: 0.85,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-nearby-family-raw',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          subjectSummary: 'cortinas roller blackout',
          topicSummary: 'cortinas roller blackout',
          activeDocumentIds: ['doc-enrollar-raw'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'active_document_continuation',
        result: expect.objectContaining({
          query: expect.stringMatching(/cortinas de enrollar/i),
          groundedSummary: expect.stringMatching(/PVC y aluminio/i),
        }),
      }),
    );
  });

  it('keeps mixed knowledge chunks available when they contain real product facts alongside operational guidance', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-mixed-1',
          documentId: 'doc-mixed',
          sequence: 0,
          content:
            'Datos útiles para presupuesto: tipo de enrollar y medidas aproximadas. Las cortinas de enrollar están disponibles en materiales como PVC y aluminio.',
          searchText:
            'datos utiles para presupuesto tipo de enrollar y medidas aproximadas las cortinas de enrollar estan disponibles en materiales como pvc y aluminio',
          metadata: {
            heading: 'Datos útiles para presupuesto',
          },
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-mixed',
            title: 'Catalogo Mixto',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'en qué materiales vienen las cortinas de enrollar',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'en qué materiales vienen las cortinas de enrollar',
        },
        language: 'es',
        confidence: 0.88,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'knowledge_query',
        result: expect.objectContaining({
          groundedSummary: expect.stringMatching(/PVC y aluminio/i),
        }),
      }),
    );
    expect(result.result?.groundedSummary).not.toMatch(/presupuesto/i);
  });

  it('prefers topic-relevant detail sentences over generic catalog introduction text in grounded summaries', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-intro-1',
          documentId: 'doc-roller',
          sequence: 0,
          content:
            'La informacion esta organizada para responder consultas de clientes sobre productos, diferencias, usos y beneficios.',
          searchText:
            'la informacion esta organizada para responder consultas de clientes sobre productos diferencias usos y beneficios',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-roller',
            title: 'Catalogo Roller',
          },
        },
        {
          id: 'chunk-types-1',
          documentId: 'doc-roller',
          sequence: 1,
          content: 'Tipos principales: - Roller Screen - Roller Blackout - Roller Doble',
          searchText:
            'tipos principales roller screen roller blackout roller doble',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-roller',
            title: 'Catalogo Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'necesito informacion sobre cortinas roller',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'necesito informacion sobre cortinas roller',
        },
        language: 'es',
        confidence: 0.9,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.groundedSummary).toContain(
      'Roller Screen, Roller Blackout, Roller Doble',
    );
    expect(result.result?.groundedSummary).not.toContain(
      'La informacion esta organizada',
    );
  });

  it('aggregates factual list claims instead of collapsing a payment-method answer to one value', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-payments-1',
          documentId: 'doc-payments',
          sequence: 0,
          content:
            '- transferencia bancaria - efectivo - Mercado Pago - tarjetas',
          searchText:
            'transferencia bancaria efectivo mercado pago tarjetas',
          retrievalProjection:
            'medios de pago transferencia bancaria efectivo mercado pago tarjetas',
          metadata: {
            section: '3. PRESUPUESTO, PAGOS Y CONFIRMACION',
            supportSummary: {
              topic: '3. PRESUPUESTO, PAGOS Y CONFIRMACION / Medios de pago',
              supportedAxes: ['payment_methods'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'transferencia bancaria',
            }),
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'efectivo',
            }),
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'Mercado Pago',
            }),
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'tarjetas',
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-payments',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Que medios de pago aceptan?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Que medios de pago aceptan?',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.groundedSummary).toContain('transferencia bancaria');
    expect(result.result?.groundedSummary).toContain('efectivo');
    expect(result.result?.groundedSummary).toContain('Mercado Pago');
    expect(result.result?.groundedSummary).toContain('tarjetas');
  });

  it('locks retrieval to the active requested axis on mixed follow-up payment questions', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-payments-followup',
          documentId: 'doc-master',
          sequence: 0,
          content:
            'Trabajamos con Mercado Pago en cuotas. También podemos trabajar por transferencia o efectivo.',
          searchText:
            'trabajamos con mercado pago en cuotas tambien podemos trabajar por transferencia o efectivo',
          retrievalProjection:
            'mercado pago cuotas transferencia efectivo medios de pago',
          metadata: {
            section: '3. PRESUPUESTO, PAGOS Y CONFIRMACION',
            supportSummary: {
              topic: '3. PRESUPUESTO, PAGOS Y CONFIRMACION / Cuotas',
              supportedAxes: ['payment_methods', 'installment_count'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'Mercado Pago',
            }),
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'transferencia',
            }),
            buildClaimKnowledgeItem({
              axis: 'payment_methods',
              value: 'efectivo',
            }),
            buildClaimKnowledgeItem({
              axis: 'installment_count',
              value: '12',
              appliesTo: [
                {
                  axis: 'payment_method',
                  value: 'Mercado Pago',
                  normalizedValue: 'mercado pago',
                },
              ],
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-master',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-visits-followup',
          documentId: 'doc-master',
          sequence: 1,
          content:
            'Realizamos visitas a domicilio, rectificación y muestras según el trabajo. También puede haber una segunda visita para la instalación final.',
          searchText:
            'realizamos visitas a domicilio rectificacion y muestras segun el trabajo tambien puede haber una segunda visita para la instalacion final',
          retrievalProjection:
            'visitas rectificacion muestras instalacion final servicios',
          metadata: {
            section: 'VISITAS, RECTIFICACION Y MUESTRAS',
            supportSummary: {
              topic: 'VISITAS, RECTIFICACION Y MUESTRAS',
              supportedAxes: ['service_offers'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'service_offers',
              value: 'visitas a domicilio',
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:01.000Z'),
          document: {
            id: 'doc-master',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'en cuantas cuotas se puede hacer y que tarjetas acepta mercado pago?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'en cuantas cuotas se puede hacer y que tarjetas acepta mercado pago?',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-payments-followup',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          topicSummary: 'cortinas roller blackout',
          lastDocumentQuery: 'cortinas roller blackout',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T20:00:00.000Z',
      },
    });

    expect(result.result?.groundedSummary).toMatch(/Mercado Pago|12/i);
    expect(result.result?.groundedSummary).not.toMatch(/visitas|rectificaci/i);
    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        sequence: 0,
        title: 'Documento Maestro',
      }),
    );
  });

  it('prefers a general family overview over a scoped variant when the user asks a broad family question', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-enrollar-overview',
          documentId: 'doc-enrollar',
          sequence: 0,
          content:
            'Las cortinas de enrollar están disponibles en PVC y aluminio, y pueden ser manuales o motorizadas.',
          searchText:
            'las cortinas de enrollar estan disponibles en pvc y aluminio y pueden ser manuales o motorizadas',
          retrievalProjection:
            'cortinas de enrollar pvc aluminio manuales motorizadas',
          metadata: {
            section: '7. PERSIANAS Y CORTINAS DE ENROLLAR',
            supportSummary: {
              topic: '7. PERSIANAS Y CORTINAS DE ENROLLAR',
              supportedAxes: ['materials', 'operation_modes'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'materials',
              value: 'PVC',
              subject: {
                axis: 'section_topic',
                value: 'PERSIANA O CORTINA DE ENROLLAR',
                normalizedValue: 'persiana o cortina de enrollar',
              },
            }),
            buildClaimKnowledgeItem({
              axis: 'materials',
              value: 'ALUMINIO',
              subject: {
                axis: 'section_topic',
                value: 'PERSIANA O CORTINA DE ENROLLAR',
                normalizedValue: 'persiana o cortina de enrollar',
              },
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-enrollar-pvc',
          documentId: 'doc-enrollar',
          sequence: 1,
          content:
            'La persiana de enrollar en PVC es una opción funcional y económica. También se la asocia con la idea de catalana o cortina de enrollar sin obra.',
          searchText:
            'la persiana de enrollar en pvc es una opcion funcional y economica catalana cortina de enrollar sin obra',
          retrievalProjection:
            'persiana cortina enrollar pvc catalana sin obra color blanco',
          metadata: {
            section: '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
            supportSummary: {
              topic: '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
              supportedAxes: ['materials', 'color_options'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'materials',
              value: 'PVC',
              subject: {
                axis: 'section_topic',
                value: 'PERSIANA O CORTINA DE ENROLLAR',
                normalizedValue: 'persiana o cortina de enrollar',
              },
              appliesTo: [
                {
                  axis: 'material',
                  value: 'PVC',
                  normalizedValue: 'pvc',
                },
              ],
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:01.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Tienen cortinas de enrollar?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Tienen cortinas de enrollar?',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.groundedSummary).toMatch(/PVC/i);
    expect(result.result?.groundedSummary).toMatch(/aluminio/i);
    expect(result.result?.groundedSummary).not.toMatch(/catalana/i);
  });

  it('builds a concrete family overview from subject-matched claims even when the query is broad', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-roller-overview',
          documentId: 'doc-roller',
          sequence: 0,
          content:
            'Roller Screen, Roller Blackout y Roller Doble. También pueden ser manuales o motorizadas.',
          searchText:
            'roller screen roller blackout roller doble tambien pueden ser manuales o motorizadas',
          retrievalProjection:
            'cortinas roller screen blackout doble manuales motorizadas',
          metadata: {
            section: '6.1. CORTINAS ROLLER',
            supportSummary: {
              topic: '6.1. CORTINAS ROLLER',
              supportedAxes: ['product_types', 'operation_modes'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'product_types',
              value: 'screen',
              subject: {
                axis: 'section_topic',
                value: 'cortinas roller',
                normalizedValue: 'cortinas roller',
              },
            }),
            buildClaimKnowledgeItem({
              axis: 'product_types',
              value: 'blackout',
              subject: {
                axis: 'section_topic',
                value: 'cortinas roller',
                normalizedValue: 'cortinas roller',
              },
            }),
            buildClaimKnowledgeItem({
              axis: 'product_types',
              value: 'doble',
              subject: {
                axis: 'section_topic',
                value: 'cortinas roller',
                normalizedValue: 'cortinas roller',
              },
            }),
            buildClaimKnowledgeItem({
              axis: 'operation_modes',
              value: 'manuales',
              subject: {
                axis: 'section_topic',
                value: 'cortinas roller',
                normalizedValue: 'cortinas roller',
              },
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-roller',
            title: 'Documento Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'tienen cortinas roller?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'tienen cortinas roller?',
        },
        language: 'es',
        confidence: 0.92,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.groundedSummary).toMatch(/screen/i);
    expect(result.result?.groundedSummary).toMatch(/blackout/i);
    expect(result.result?.groundedSummary).not.toMatch(/contame que queres resolver/i);
  });

  it('does not drop broad GET_PRODUCT availability questions out of document retrieval when the product subject was parsed', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-enrollar-aluminio',
          documentId: 'doc-enrollar',
          sequence: 0,
          content:
            'La persiana de enrollar en aluminio es la variante más robusta dentro de esta familia.',
          searchText:
            'la persiana de enrollar en aluminio es la variante mas robusta dentro de esta familia',
          retrievalProjection:
            'cortina enrollar aluminio variante robusta',
          metadata: {
            section: '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
            supportSummary: {
              topic: '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            buildClaimKnowledgeItem({
              axis: 'materials',
              value: 'aluminio',
              subject: {
                axis: 'section_topic',
                value: 'cortina de enrollar',
                normalizedValue: 'cortina de enrollar',
              },
              appliesTo: [
                {
                  axis: 'material',
                  value: 'aluminio',
                  normalizedValue: 'aluminio',
                },
              ],
            }),
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'tienen cortina de enrollar en aluminio?',
      interpretation: {
        intent: 'GET_PRODUCT',
        entities: {
          rawMessage: 'tienen cortina de enrollar en aluminio?',
          productQuery: 'cortina de enrollar en aluminio',
          requestSummary: 'Consulta sobre disponibilidad de cortina de enrollar en aluminio',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.reason).toBe('knowledge_query');
    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        sequence: 0,
      }),
    );
    expect(result.result?.groundedSummary).toMatch(/aluminio/i);
  });

  it('boosts matching subsection aliases over a generic parent chunk for technical follow-ups', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-aberturas-general',
          documentId: 'doc-aberturas',
          sequence: 0,
          content:
            'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
          searchText:
            'trabajamos aberturas en aluminio tanto en lineas estandar como en lineas de alta prestacion',
          retrievalProjection: 'aberturas aluminio lineas estandar alta prestacion',
          metadata: {
            section: '12. ABERTURAS EN ALUMINIO',
            supportSummary: {
              topic: '12. ABERTURAS EN ALUMINIO',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-aberturas',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-gala-dvh',
          documentId: 'doc-aberturas',
          sequence: 1,
          content:
            'La Serie Gala es una línea de alta prestación versátil y estética. Permite sumar DVH para mejorar el aislamiento térmico y acústico.',
          searchText:
            'serie gala linea alta prestacion permite sumar dvh aislamiento termico acustico',
          retrievalProjection: 'serie gala admite dvh alta prestacion',
          metadata: {
            section: '12.3. SERIE GALA',
            parentSection: '12. ABERTURAS EN ALUMINIO',
            supportSummary: {
              topic: '12.3. SERIE GALA',
              supportedAxes: [],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-05T20:00:01.000Z'),
          document: {
            id: 'doc-aberturas',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Serie 20 gala o alguna que soporte dvh?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Serie 20 gala o alguna que soporte dvh?',
          requestSummary: 'serie gala soporte dvh',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-gala-dvh',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'aberturas',
          topicSummary: 'aberturas',
          activeDocumentIds: ['doc-aberturas'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T20:00:00.000Z',
      },
    });

    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        sequence: 1,
      }),
    );
    expect(result.result?.groundedSummary).toMatch(/Gala|DVH/i);
  });

  it('keeps nearby aluminum families out of the top matches when the query is clearly about aberturas', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-aberturas-overview',
          documentId: 'doc-maestro',
          sequence: 0,
          content:
            'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
          searchText:
            'trabajamos aberturas en aluminio tanto en lineas estandar como en lineas de alta prestacion',
          retrievalProjection:
            'aberturas aluminio lineas estandar alta prestacion',
          metadata: {
            section: '12. ABERTURAS EN ALUMINIO',
            supportSummary: {
              topic: '12. ABERTURAS EN ALUMINIO',
              supportedAxes: ['specific_variants'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-enrollar-aluminio',
          documentId: 'doc-maestro',
          sequence: 1,
          content:
            'Las persianas o cortinas de enrollar en aluminio pueden ser manuales o motorizadas y vienen en varios colores.',
          searchText:
            'persianas cortinas de enrollar en aluminio manuales motorizadas varios colores',
          retrievalProjection:
            'persianas cortinas enrollar aluminio colores manuales motorizadas',
          metadata: {
            section: '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
            parentSection: '7. PERSIANAS Y CORTINAS DE ENROLLAR',
            supportSummary: {
              topic: '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
              supportedAxes: ['color_options', 'operation_modes'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-05T20:00:01.000Z'),
          document: {
            id: 'doc-maestro',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Trabajan aberturas en aluminio? Que lineas tienen?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Trabajan aberturas en aluminio? Que lineas tienen?',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        sequence: 0,
      }),
    );
    expect(result.result?.matches.some((match) => match.sequence === 1)).toBe(false);
    expect(result.result?.groundedSummary).toMatch(/aberturas en aluminio/i);
    expect(result.result?.groundedSummary).not.toMatch(/cortinas de enrollar|persianas/i);
  });

  it('prefers an exact-subject limitation chunk over a richer nearby series chunk', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-serie-20-25',
          documentId: 'doc-aberturas',
          sequence: 1,
          content:
            'Las Series 20 y 25 son una alternativa estándar y no soportan DVH.',
          searchText:
            'series 20 y 25 alternativa estandar no soportan dvh doble vidrio',
          retrievalProjection:
            'serie 20 y 25 compatibilidad no soporta dvh doble vidrio',
          metadata: {
            section: '12.1. SERIE 20 Y 25',
            parentSection: '12. ABERTURAS EN ALUMINIO',
            supportSummary: {
              topic: '12.1. SERIE 20 Y 25',
              supportedAxes: ['feature_support'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-aberturas',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'feature_support',
              valueText: 'DVH, doble vidrio',
              normalizedValue: 'dvh doble vidrio',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan: 'Estas series no soportan DVH.',
              metadata: {
                claim: {
                  axis: 'feature_support',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: ['DVH', 'doble vidrio'],
                  subject: {
                    axis: 'section_topic',
                    value: 'SERIE 20 Y 25',
                    normalizedValue: 'serie 20 y 25',
                  },
                  appliesTo: [
                    {
                      axis: 'support_state',
                      value: 'does_not_support',
                      normalizedValue: 'does not support',
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          id: 'chunk-probba-dvh',
          documentId: 'doc-aberturas',
          sequence: 2,
          content:
            'La Serie Probba admite vidrio simple o DVH y es una línea de alta prestación.',
          searchText:
            'serie probba admite vidrio simple o dvh linea alta prestacion',
          retrievalProjection:
            'serie probba compatibilidad admite vidrio simple dvh doble vidrio',
          metadata: {
            section: '12.2. SERIE PROBBA',
            parentSection: '12. ABERTURAS EN ALUMINIO',
            supportSummary: {
              topic: '12.2. SERIE PROBBA',
              supportedAxes: ['feature_support'],
              unspecifiedAxes: [],
            },
          },
          createdAt: new Date('2026-04-05T20:00:01.000Z'),
          document: {
            id: 'doc-aberturas',
            title: 'Documento Maestro',
          },
          knowledgeItems: [
            {
              kind: 'CLAIM',
              label: 'feature_support',
              valueText: 'vidrio simple, DVH, doble vidrio',
              normalizedValue: 'vidrio simple dvh doble vidrio',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan: 'Admite vidrio simple o DVH.',
              metadata: {
                claim: {
                  axis: 'feature_support',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: ['vidrio simple', 'DVH', 'doble vidrio'],
                  subject: {
                    axis: 'section_topic',
                    value: 'SERIE PROBBA',
                    normalizedValue: 'serie probba',
                  },
                  appliesTo: [
                    {
                      axis: 'support_state',
                      value: 'supports',
                      normalizedValue: 'supports',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'la serie 25 permite doble vidrio?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'la serie 25 permite doble vidrio?',
          productQuery: 'serie 25 doble vidrio',
          requestSummary: 'Consulta sobre si la serie 25 permite doble vidrio',
        },
        language: 'es',
        confidence: 0.96,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-serie-25',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'aberturas con doble vidrio más económicas',
          topicSummary: 'aberturas con doble vidrio más económicas',
          activeDocumentIds: ['doc-aberturas'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T20:00:00.000Z',
      },
    });

    expect(result.result?.matches[0]).toEqual(
      expect.objectContaining({
        sequence: 1,
      }),
    );
    expect(result.result?.groundedSummary).toMatch(/no soporta/i);
    expect(result.result?.groundedSummary).toMatch(/DVH|doble vidrio/i);
  });

  it('retags retrieval as combined booking context after decisioning confirms booking', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          sequence: 0,
          content: 'Cubrimos cambio de cadena de cortinas roller.',
          searchText: 'cubrimos cambio de cadena de cortinas roller',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-1',
            title: 'Servicios',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const preview = await service.retrieveForConversation({
      message:
        'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
      interpretation: {
        intent: 'CREATE_BOOKING',
        entities: {
          rawMessage:
            'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
          requestSummary: 'cambio de cadena de cortina roller',
        },
        language: 'es',
        confidence: 0.96,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    const result = service.withDecisionContext(preview, {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_booking',
        reasonCode: 'booking_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.booking.confirmation',
    });

    expect(result.reason).toBe('combined_booking_document_query');
    expect(result.result?.query).toBe('cambio de cadena de cortina roller');
  });

  it('keeps runtime-learned knowledge out of the primary document retrieval path', () => {
    const source = readBackendSource(
      'modules',
      'documents',
      'document-retrieval.service.ts',
    );

    expect(source).not.toContain('KnowledgeService');
    expect(source).not.toContain('KnowledgeRepository');
    expect(source).toContain('DocumentChunkRepository');
  });

  it('continues document exploration across follow-up turns without repeated document cue words', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-2',
          documentId: 'doc-9',
          sequence: 1,
          content: 'La tela screen está disponible en tonos claros y filtra la luz.',
          searchText:
            'la tela screen esta disponible en tonos claros y filtra la luz',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-9',
            title: 'Catálogo Screen',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: '¿y en colores más claros?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: '¿y en colores más claros?',
        },
        language: 'es',
        confidence: 0.82,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-doc',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          activeDocumentIds: ['doc-9'],
          topicSummary: 'tela screen para cortinas roller',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        reason: 'active_document_continuation',
        result: expect.objectContaining({
          source: 'document_origin',
          query: expect.stringMatching(/tela screen/i),
        }),
      }),
    );
  });

  it('prefers the most query-relevant sentence inside a matched chunk instead of the first generic sentence', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-ven-1',
          documentId: 'doc-ven',
          sequence: 0,
          content:
            'Las cortinas venecianas permiten controlar la luz y la privacidad. Contamos con variedad de colores que permiten combinarlas con distintos ambientes.',
          searchText:
            'las cortinas venecianas permiten controlar la luz y la privacidad contamos con variedad de colores que permiten combinarlas con distintos ambientes',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-ven',
            title: 'Venecianas',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Según el catálogo, ¿qué colores exactos tienen las cortinas venecianas?',
      interpretation: {
        intent: 'GET_PRODUCT',
        entities: {
          rawMessage:
            'Según el catálogo, ¿qué colores exactos tienen las cortinas venecianas?',
        },
        language: 'es',
        confidence: 0.9,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.matches[0]?.excerpt).toMatch(/variedad de colores/i);
  });

  it('builds a processed grounded summary instead of echoing heading-style excerpts verbatim', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-roller-summary',
          documentId: 'doc-summary',
          sequence: 0,
          content:
            'Cortinas de Enrollar: disponibles en PVC y aluminio. También pueden ser manuales o motorizadas.',
          searchText:
            'cortinas de enrollar disponibles en pvc y aluminio tambien pueden ser manuales o motorizadas',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-summary',
            title: 'Resumen Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'Según el catálogo, ¿son manuales o motorizadas?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Según el catálogo, ¿son manuales o motorizadas?',
        },
        language: 'es',
        confidence: 0.91,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result.result?.groundedSummary).toBe(
      'También pueden ser manuales o motorizadas.',
    );
    expect(result.result?.groundedSummary).not.toContain('Cortinas de Enrollar:');
  });

  it('prefers the scoped factual claim whose applies_to matches the requested variant', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-pvc-color',
          documentId: 'doc-enrollar',
          sequence: 0,
          content: '- color blanco',
          searchText: 'color blanco pvc cortina enrollar',
          retrievalProjection:
            'persiana cortina enrollar color_options material pvc blanco',
          metadata: {
            supportSummary: {
              topic: '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
              supportedAxes: ['color_options'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              id: 'ki-pvc-color',
              documentId: 'doc-enrollar',
              chunkId: 'chunk-pvc-color',
              sequence: 0,
              kind: 'CLAIM',
              label: 'color_options',
              valueText: 'blanco',
              normalizedValue: 'blanco',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan: '- color blanco',
              metadata: {
                claim: {
                  axis: 'color_options',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: ['blanco'],
                  subject: {
                    axis: 'section_topic',
                    value: 'PERSIANA O CORTINA DE ENROLLAR',
                    normalizedValue: 'persiana o cortina de enrollar',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'PVC',
                      normalizedValue: 'pvc',
                    },
                  ],
                },
                extractionScope: 'tenant_only',
              },
              createdAt: new Date('2026-04-05T17:24:00.000Z'),
            },
          ],
          createdAt: new Date('2026-04-05T17:24:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-al-color',
          documentId: 'doc-enrollar',
          sequence: 1,
          content: '- variedad de colores(blanco negro marron color madera gris verde)',
          searchText:
            'variedad de colores blanco negro marron color madera gris verde aluminio cortina enrollar',
          retrievalProjection:
            'persiana cortina enrollar color_options material aluminio blanco negro marron color madera gris verde',
          metadata: {
            supportSummary: {
              topic: '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
              supportedAxes: ['color_options'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              id: 'ki-al-color',
              documentId: 'doc-enrollar',
              chunkId: 'chunk-al-color',
              sequence: 0,
              kind: 'CLAIM',
              label: 'color_options',
              valueText: 'blanco | negro | marron | color madera | gris | verde',
              normalizedValue:
                'blanco negro marron color madera gris verde',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan:
                '- variedad de colores(blanco negro marron color madera gris verde)',
              metadata: {
                claim: {
                  axis: 'color_options',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: [
                    'blanco',
                    'negro',
                    'marron',
                    'color madera',
                    'gris',
                    'verde',
                  ],
                  subject: {
                    axis: 'section_topic',
                    value: 'PERSIANA O CORTINA DE ENROLLAR',
                    normalizedValue: 'persiana o cortina de enrollar',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'ALUMINIO',
                      normalizedValue: 'aluminio',
                    },
                  ],
                },
                extractionScope: 'tenant_only',
              },
              createdAt: new Date('2026-04-05T17:24:00.000Z'),
            },
          ],
          createdAt: new Date('2026-04-05T17:24:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'y las cortinas de enrollar en pvc que colores hay disponibles?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'y las cortinas de enrollar en pvc que colores hay disponibles?',
          requestSummary: 'cortinas de enrollar en pvc colores disponibles',
        },
        language: 'es',
        confidence: 0.92,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-pvc-colors',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'cortinas de enrollar',
          topicSummary: 'cortinas de enrollar',
          activeDocumentIds: ['doc-enrollar'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T17:24:00.000Z',
      },
    });

    expect(result.result?.matches[0]?.sequence).toBe(0);
    expect(result.result?.groundedSummary).toMatch(/blanco/i);
    expect(result.result?.groundedSummary).not.toMatch(/negro/i);
  });

  it('reuses the last document query as scoped follow-up context for short detail questions', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-pvc-color-followup',
          documentId: 'doc-enrollar',
          sequence: 0,
          content: '- color blanco',
          searchText: 'color blanco pvc cortina enrollar',
          retrievalProjection:
            'persiana cortina enrollar color_options material pvc blanco',
          metadata: {
            supportSummary: {
              topic: '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
              supportedAxes: ['color_options'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              id: 'ki-pvc-followup',
              documentId: 'doc-enrollar',
              chunkId: 'chunk-pvc-color-followup',
              sequence: 0,
              kind: 'CLAIM',
              label: 'color_options',
              valueText: 'blanco',
              normalizedValue: 'blanco',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan: '- color blanco',
              metadata: {
                claim: {
                  axis: 'color_options',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: ['blanco'],
                  subject: {
                    axis: 'section_topic',
                    value: 'PERSIANA O CORTINA DE ENROLLAR',
                    normalizedValue: 'persiana o cortina de enrollar',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'PVC',
                      normalizedValue: 'pvc',
                    },
                  ],
                },
                extractionScope: 'tenant_only',
              },
              createdAt: new Date('2026-04-05T17:24:00.000Z'),
            },
          ],
          createdAt: new Date('2026-04-05T17:24:00.000Z'),
          document: {
            id: 'doc-enrollar',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'que colores tienen?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'que colores tienen?',
        },
        language: 'es',
        confidence: 0.86,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-pvc-followup',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'cortinas de enrollar en aluminio',
          topicSummary: 'cortinas de enrollar en aluminio',
          lastDocumentQuery: 'cortinas de enrollar pvc',
          activeDocumentIds: ['doc-enrollar'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T17:24:00.000Z',
      },
    });

    expect(result.result?.query).toMatch(/pvc/i);
    expect(result.result?.groundedSummary).toMatch(/blanco/i);
  });

  it('uses the stable subject plus current facet for longer follow-ups instead of dragging the full previous query chain', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-aberturas-workflow',
          documentId: 'doc-aberturas',
          sequence: 0,
          content:
            'Si la consulta es por aberturas en aluminio: preguntamos medidas aproximadas, si quiere DVH y si necesita monoblock, mosquitero o cortina integrada.',
          searchText:
            'aberturas aluminio consulta presupuesto medidas aproximadas quiere dvh monoblock mosquitero cortina integrada',
          metadata: null,
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-aberturas',
            title: 'Documento Maestro',
          },
        },
        {
          id: 'chunk-gala',
          documentId: 'doc-aberturas',
          sequence: 1,
          content:
            'La Serie Gala es una línea de alta prestación versátil y estética, pensada para proyectos que buscan mejor confort.',
          searchText:
            'serie gala alta prestacion versatil estetica proyectos mejor confort',
          metadata: {
            supportSummary: {
              topic: '12.3. SERIE GALA / Alias útiles',
              supportedAxes: [],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              id: 'ki-gala-material',
              documentId: 'doc-aberturas',
              chunkId: 'chunk-gala',
              sequence: 0,
              kind: 'CLAIM',
              label: 'materials',
              valueText: 'ALUMINIO',
              normalizedValue: 'aluminio',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan: 'Trabajamos aberturas en aluminio.',
              metadata: {
                claim: {
                  axis: 'materials',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: ['ALUMINIO'],
                  subject: {
                    axis: 'section_topic',
                    value: 'ABERTURAS',
                    normalizedValue: 'aberturas',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'ALUMINIO',
                      normalizedValue: 'aluminio',
                    },
                  ],
                },
                extractionScope: 'tenant_only',
              },
              createdAt: new Date('2026-04-05T20:00:00.000Z'),
            },
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-aberturas',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'que datos necesitan para pasarme una cotizacion?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'que datos necesitan para pasarme una cotizacion?',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-aberturas-quote',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'aberturas',
          topicSummary: 'aberturas',
          lastDocumentQuery:
            'aberturas en aluminio. serie gala alguna soporte dvh. cual proceso coordinar relevamiento',
          activeDocumentIds: ['doc-aberturas'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T20:00:00.000Z',
      },
    });

    expect(result.result?.query).toMatch(/aberturas/i);
    expect(result.result?.query).toMatch(/cotizacion/i);
    expect(result.result?.query).not.toMatch(/gala/i);
    expect(result.result?.matches[0]?.sequence).toBe(0);
    expect(result.result?.groundedSummary).toMatch(/medidas aproximadas/i);
    expect(result.result?.groundedSummary).not.toBe('ALUMINIO');
  });

  it('does not collapse a generic openings summary into a bare material value when the user asked about lines', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-openings-1',
          documentId: 'doc-openings',
          sequence: 0,
          content:
            'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
          searchText:
            'trabajamos aberturas en aluminio tanto en lineas estandar como en lineas de alta prestacion',
          metadata: {
            supportSummary: {
              topic: '12. ABERTURAS EN ALUMINIO',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
            },
          },
          knowledgeItems: [
            {
              id: 'ki-openings-material',
              documentId: 'doc-openings',
              chunkId: 'chunk-openings-1',
              sequence: 0,
              kind: 'CLAIM',
              label: 'materials',
              valueText: 'ALUMINIO',
              normalizedValue: 'aluminio',
              supportClass: 'EXPLICIT_FACT',
              evidenceTextSpan: 'Trabajamos aberturas en aluminio.',
              metadata: {
                claim: {
                  axis: 'materials',
                  kind: 'relational_fact',
                  layer: 'factual',
                  values: ['ALUMINIO'],
                  subject: {
                    axis: 'section_topic',
                    value: 'ABERTURAS',
                    normalizedValue: 'aberturas',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'ALUMINIO',
                      normalizedValue: 'aluminio',
                    },
                  ],
                },
                extractionScope: 'tenant_only',
              },
              createdAt: new Date('2026-04-05T20:00:00.000Z'),
            },
          ],
          createdAt: new Date('2026-04-05T20:00:00.000Z'),
          document: {
            id: 'doc-openings',
            title: 'Documento Maestro',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message: 'que lineas tienen',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'que lineas tienen',
          requestSummary: 'aberturas que lineas tienen',
        },
        language: 'es',
        confidence: 0.95,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-openings-lines',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        approvedFacts: {
          subjectSummary: 'aberturas',
          topicSummary: 'aberturas',
          activeDocumentIds: ['doc-openings'],
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-05T20:00:00.000Z',
      },
    });

    expect(result.result?.groundedSummary).toMatch(/líneas estándar|lineas estandar/i);
    expect(result.result?.groundedSummary).not.toBe('ALUMINIO');
  });

  it('returns an empty document result instead of a misleading low-score grounded summary', async () => {
    const service = new DocumentRetrievalService({
      listActiveReadyChunks: jest.fn(async () => [
        {
          id: 'chunk-low-1',
          documentId: 'doc-low',
          sequence: 0,
          content:
            'Las cortinas roller se pueden clasificar en dos tipos según el pasaje de luz.',
          searchText:
            'las cortinas roller se pueden clasificar en dos tipos segun el pasaje de luz',
          metadata: null,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          document: {
            id: 'doc-low',
            title: 'Catalogo Roller',
          },
        },
      ]),
    } as any, new ConversationSignalResolverService());

    const result = await service.retrieveForConversation({
      message:
        'Según el documento, ¿cubren cambio de cadena de una roller? Si sí, agendame una visita.',
      interpretation: {
        intent: 'CREATE_BOOKING',
        entities: {
          rawMessage:
            'Según el documento, ¿cubren cambio de cadena de una roller? Si sí, agendame una visita.',
          requestSummary: 'cambio de cadena de una roller',
        },
        language: 'es',
        confidence: 0.94,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: null,
    });

    expect(result).toEqual({
      attempted: true,
      reason: 'document_query',
      result: {
        source: 'document_origin',
        query: '¿cubren cambio de cadena de una roller',
        groundedSummary: '',
        matches: [],
      },
    });
  });

  it('does not treat channel/system interference as a document retrieval request', async () => {
    const repository = {
      listActiveReadyChunks: jest.fn(async () => []),
    };
    const service = new DocumentRetrievalService(
      repository as any,
      new ConversationSignalResolverService(),
    );

    const result = await service.retrieveForConversation({
      message: 'Mensaje automático: gracias por comunicarte.',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        entities: {
          rawMessage: 'Mensaje automático: gracias por comunicarte.',
        },
        language: 'es',
        confidence: 0.74,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
      conversationState: {
        conversationId: 'conv-doc',
        lane: 'document_exploration',
        lastIntent: 'GENERAL_CONVERSATION',
        lastApprovedAction: 'respond',
        lastApprovedToolName: undefined,
        approvedFacts: {
          activeDocumentIds: ['doc-9'],
          topicSummary: 'tela screen para cortinas roller',
        },
        pendingFacts: undefined,
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedResult: undefined,
        metadata: undefined,
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(result).toEqual({
      attempted: false,
      reason: 'not_requested',
      result: null,
    });
    expect(repository.listActiveReadyChunks).not.toHaveBeenCalled();
  });
});

function buildClaimKnowledgeItem(input: {
  axis: string;
  value: string;
  subject?: { axis: string; value: string; normalizedValue?: string };
  appliesTo?: Array<{ axis: string; value: string; normalizedValue?: string }>;
}) {
  return {
    id: `ki-${input.axis}-${input.value}`,
    documentId: 'doc-synthetic',
    chunkId: 'chunk-synthetic',
    sequence: 0,
    kind: 'CLAIM',
    label: input.axis,
    valueText: input.value,
    normalizedValue: input.value.toLowerCase(),
    supportClass: 'EXPLICIT_FACT',
    evidenceTextSpan: input.value,
    metadata: {
      claim: {
        axis: input.axis,
        kind: 'relational_fact',
        layer: 'factual',
        values: [input.value],
        subject: input.subject,
        appliesTo: input.appliesTo,
      },
      extractionScope: 'tenant_only',
    },
    createdAt: new Date('2026-04-05T20:00:00.000Z'),
  };
}

function buildMetadataKnowledgeItem(input: {
  axis: string;
  value: string;
  layer: 'workflow' | 'guidance' | 'prudence';
  subject?: { axis: string; value: string; normalizedValue?: string };
  appliesTo?: Array<{ axis: string; value: string; normalizedValue?: string }>;
}) {
  return {
    id: `ki-${input.axis}-${input.value}`,
    documentId: 'doc-synthetic',
    chunkId: 'chunk-synthetic',
    sequence: 0,
    kind: 'CLAIM',
    label: input.axis,
    valueText: input.value,
    normalizedValue: input.value.toLowerCase(),
    supportClass: 'EXPLICIT_FACT',
    evidenceTextSpan: input.value,
    metadata: {
      claim: {
        axis: input.axis,
        kind: 'guidance_signal',
        layer: input.layer,
        values: [input.value],
        subject: input.subject,
        appliesTo: input.appliesTo,
      },
      extractionScope: 'tenant_only',
    },
    createdAt: new Date('2026-04-05T20:00:00.000Z'),
  };
}
