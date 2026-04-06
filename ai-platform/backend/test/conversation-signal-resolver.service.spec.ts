import { ConversationSignalResolverService } from '../src/modules/conversation-signals/conversation-signal-resolver.service';

describe('ConversationSignalResolverService', () => {
  const service = new ConversationSignalResolverService();

  it('resolves locale-aware document signals for Spanish document-grounded questions', () => {
    const signals = service.resolve({
      message: '¿Qué dice el catálogo sobre la tela screen?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: '¿Qué dice el catálogo sobre la tela screen?',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.document.explicitRequest).toBe(true);
    expect(signals.document.lexicalScore).toBeGreaterThan(0);
    expect(signals.document.focusText).toBe(
      '¿Qué dice el catálogo sobre la tela screen',
    );
    expect(signals.document.matchedCategories).toEqual(
      expect.arrayContaining(['source_reference', 'grounding_inquiry']),
    );
  });

  it('isolates the document-focused segment when a turn combines document inquiry with booking', () => {
    const signals = service.resolve({
      message:
        'Según el documento, ¿cubren cambio de cadena de una roller? Si sí, agendame una visita para mañana a las 11.',
      interpretation: {
        intent: 'CREATE_BOOKING',
        language: 'es',
        entities: {
          rawMessage:
            'Según el documento, ¿cubren cambio de cadena de una roller? Si sí, agendame una visita para mañana a las 11.',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.document.explicitRequest).toBe(true);
    expect(signals.document.focusText).toBe(
      '¿cubren cambio de cadena de una roller',
    );
  });

  it('supports advisory exploration signals without depending on one exact phrase or one language', () => {
    const signals = service.resolve({
      message:
        'Which option would be better if I want more privacy without making the room too dark?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'en',
        entities: {
          rawMessage:
            'Which option would be better if I want more privacy without making the room too dark?',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.advisory.supported).toBe(true);
    expect(signals.advisory.lexicalScore).toBeGreaterThan(0);
    expect(signals.advisory.matchedCategories).toEqual(
      expect.arrayContaining(['recommendation', 'preference']),
    );
  });

  it('supports active document continuation even when the follow-up omits explicit document cue words', () => {
    const signals = service.resolve({
      message: '¿y en colores más claros cuál conviene más?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: '¿y en colores más claros cuál conviene más?',
        },
      } as any,
      conversationState: {
        conversationId: 'conv-doc',
        lane: 'document_exploration',
        updatedAt: '2026-04-04T10:00:00.000Z',
        missingFields: [],
      } as any,
    });

    expect(signals.document.explicitRequest).toBe(false);
    expect(signals.document.continuationEligible).toBe(true);
  });

  it('treats additive bridge wording as follow-up carryover instead of a hard topic switch', () => {
    const signals = service.resolve({
      message: 'También tienen cortinas de enrollar exteriores?',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: 'También tienen cortinas de enrollar exteriores?',
        },
      } as any,
      conversationState: {
        conversationId: 'conv-doc-follow-up',
        lane: 'document_exploration',
        updatedAt: '2026-04-04T10:00:00.000Z',
        missingFields: [],
        approvedFacts: {
          subjectSummary: 'cortinas de enrollar',
        },
      } as any,
    });

    expect(signals.threading.bridge).toBe(true);
    expect(signals.threading.switchSuggested).toBe(false);
    expect(signals.threading.topicCarryoverEligible).toBe(true);
    expect(signals.threading.incrementalFollowUp).toBe(true);
  });

  it('marks topic-rich knowledge requests as implicitly eligible without requiring explicit document cue words', () => {
    const signals = service.resolve({
      message: 'Necesito información de cortinas de enrollar en aluminio',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: 'Necesito información de cortinas de enrollar en aluminio',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.document.explicitRequest).toBe(false);
    expect(signals.document.implicitEligible).toBe(true);
  });

  it('keeps broad GET_PRODUCT questions implicitly eligible when a product subject entity was parsed', () => {
    const signals = service.resolve({
      message: 'tienen cortinas roller?',
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'es',
        entities: {
          rawMessage: 'tienen cortinas roller?',
          productQuery: 'cortinas roller',
          requestSummary: 'Consulta sobre disponibilidad de cortinas roller',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.document.explicitRequest).toBe(false);
    expect(signals.document.implicitEligible).toBe(true);
  });

  it('does not force a hard switch on polite re-openers when there is no active thread to switch away from', () => {
    const signals = service.resolve({
      message: 'disculpe otra consulta, tienen cortina de enrollar? en aluminio',
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'es',
        entities: {
          rawMessage: 'disculpe otra consulta, tienen cortina de enrollar? en aluminio',
          productQuery: 'cortina de enrollar en aluminio',
          requestSummary: 'Consulta sobre disponibilidad de cortina de enrollar en aluminio',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.threading.switchSuggested).toBe(false);
    expect(signals.document.implicitEligible).toBe(true);
  });

  it('detects gratitude and decline signals for contextual close-turn decisions', () => {
    const signals = service.resolve({
      message: 'No gracias, ya resolví',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: 'No gracias, ya resolví',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.closure.supported).toBe(true);
    expect(signals.closure.gratitude).toBe(true);
    expect(signals.closure.decline).toBe(true);
  });

  it('detects contextual resume and short follow-up signals without encoding them in decisive services', () => {
    const signals = service.resolve({
      message: 'Si me interesa',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: 'Si me interesa',
        },
      } as any,
      conversationState: {
        conversationId: 'conv-follow-up',
        lane: 'quote',
        updatedAt: '2026-04-04T10:00:00.000Z',
        missingFields: [],
      } as any,
    });

    expect(signals.threading.shortFollowUp).toBe(true);
    expect(signals.threading.resume).toBe(true);
    expect(signals.threading.activeContinuation).toBe(false);
    expect(signals.threading.topicCarryoverEligible).toBe(false);
  });

  it('detects explicit thread switching without forcing one tenant-specific topic taxonomy', () => {
    const signals = service.resolve({
      message: 'Retomo por acá, pero ahora te consulto por otra abertura.',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: 'Retomo por acá, pero ahora te consulto por otra abertura.',
        },
      } as any,
      conversationState: {
        conversationId: 'conv-switch',
        lane: 'quote',
        updatedAt: '2026-04-04T10:00:00.000Z',
        missingFields: [],
      } as any,
    });

    expect(signals.threading.resume).toBe(true);
    expect(signals.threading.switchSuggested).toBe(true);
  });

  it('flags channel/system interference separately from the active user topic', () => {
    const signals = service.resolve({
      message: 'Mensaje automático: gracias por comunicarte.',
      interpretation: {
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
        entities: {
          rawMessage: 'Mensaje automático: gracias por comunicarte.',
        },
      } as any,
      conversationState: null,
    });

    expect(signals.noise.channelInterference).toBe(true);
  });
});
