import { InterpretationService } from '../src/modules/interpretation/interpretation.service';

describe('InterpretationService', () => {
  it('normalizes structured interpretation output', async () => {
    const service = new InterpretationService(
      {
        interpret: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"intent":"tenant.get_product","entities":{"productQuery":"quiero algo barato"},"language":"ES-UY","confidence":0.9}',
          parsedResponse: {
            intent: 'tenant.get_product',
            entities: {
              productQuery: 'quiero algo barato',
            },
            language: 'ES-UY',
            confidence: 0.9,
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
        })),
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(service.interpret('quiero algo barato', 'es')).resolves.toEqual(
      expect.objectContaining({
        interpretation: {
          intent: 'GET_PRODUCT',
          entities: {
            productQuery: 'quiero algo barato',
            rawMessage: 'quiero algo barato',
          },
          language: 'es',
          confidence: 0.9,
        },
        usedFallback: false,
      }),
    );
  });

  it('drops tenant-specific semantic overlays when they arrive from the provider without explicit core backing', async () => {
    const service = new InterpretationService(
      {
        interpret: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"intent":"GET_PRODUCT","entities":{"price":"low","location":"kitchen"},"language":"es","confidence":0.91}',
          parsedResponse: {
            intent: 'GET_PRODUCT',
            entities: {
              price: 'low',
              location: 'kitchen',
            },
            language: 'es',
            confidence: 0.91,
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
        })),
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(service.interpret('quiero algo barato para la cocina', 'es')).resolves.toEqual(
      expect.objectContaining({
        interpretation: expect.objectContaining({
          entities: {
            rawMessage: 'quiero algo barato para la cocina',
          },
        }),
      }),
    );
  });

  it('falls back safely when AI fails', async () => {
    const service = new InterpretationService(
      {
        interpret: jest.fn(async () => ({
          ok: false,
          rawResponse: 'not-json',
          parsedResponse: null,
          error: 'Unexpected token o in JSON at position 1',
          provider: 'openai',
          model: 'gpt-4o-mini',
        })),
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(service.interpret('hola', 'es')).resolves.toEqual(
      expect.objectContaining({
        interpretation: {
          intent: 'GENERAL_CONVERSATION',
          entities: {
            rawMessage: 'hola',
          },
          language: 'unknown',
          confidence: 0,
        },
        rawAiResponse: 'not-json',
        error: 'Unexpected token o in JSON at position 1',
        usedFallback: true,
      }),
    );
  });

  it('preserves the original user message when the provider omits raw booking detail', async () => {
    const service = new InterpretationService(
      {
        interpret: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"intent":"CREATE_BOOKING","entities":{"dateCandidates":["mañana a las 11"]},"language":"es","confidence":0.88}',
          parsedResponse: {
            intent: 'CREATE_BOOKING',
            entities: {
              dateCandidates: ['mañana a las 11'],
              price: '/',
              sku: 'cadena cortina roller',
            },
            language: 'es',
            confidence: 0.88,
          },
          error: null,
          provider: 'openai',
          model: 'gpt-4.1-mini',
        })),
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.interpret(
        'Necesito agendar una visita para mañana a las 11 para cambiar la cadena de una cortina roller.',
        'es',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        interpretation: expect.objectContaining({
          intent: 'CREATE_BOOKING',
          entities: expect.objectContaining({
            rawMessage:
              'Necesito agendar una visita para mañana a las 11 para cambiar la cadena de una cortina roller.',
            dateCandidates: ['mañana a las 11'],
          }),
        }),
      }),
    );

    await expect(
      service.interpret(
        'Necesito agendar una visita para mañana a las 11 para cambiar la cadena de una cortina roller.',
        'es',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        interpretation: expect.objectContaining({
          entities: expect.not.objectContaining({
            price: '/',
            sku: 'cadena cortina roller',
          }),
        }),
      }),
    );
  });

  it('preserves productQuery and requestSummary on general conversation turns for downstream retrieval and continuity', async () => {
    const service = new InterpretationService(
      {
        interpret: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"intent":"GENERAL_CONVERSATION","entities":{"productQuery":"cortinas roller","requestSummary":"consulta sobre opciones de roller"},"language":"es","confidence":0.88}',
          parsedResponse: {
            intent: 'GENERAL_CONVERSATION',
            entities: {
              productQuery: 'cortinas roller',
              requestSummary: 'consulta sobre opciones de roller',
            },
            language: 'es',
            confidence: 0.88,
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
        })),
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.interpret('necesito informacion de cortinas roller', 'es'),
    ).resolves.toEqual(
      expect.objectContaining({
        interpretation: expect.objectContaining({
          intent: 'GENERAL_CONVERSATION',
          entities: expect.objectContaining({
            rawMessage: 'necesito informacion de cortinas roller',
            productQuery: 'cortinas roller',
            requestSummary: 'consulta sobre opciones de roller',
          }),
        }),
      }),
    );
  });
});
