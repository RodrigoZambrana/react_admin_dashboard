import { readFileSync } from 'node:fs';

import { ConversationSignalResolverService } from '../src/modules/conversation-signals/conversation-signal-resolver.service';
import { DocumentRetrievalService } from '../src/modules/documents/document-retrieval.service';

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
          query: 'cortinas de enrollar',
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
          query: 'cortinas de enrollar',
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
    const source = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-retrieval.service.ts',
      'utf8',
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
