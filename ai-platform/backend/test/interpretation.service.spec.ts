import { InterpretationService } from '../src/modules/interpretation/interpretation.service';

describe('InterpretationService', () => {
  it('normalizes structured interpretation output', async () => {
    const service = new InterpretationService(
      {
        interpret: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"intent":"tenant.get_product","entities":{"price":"low"},"language":"ES-UY","confidence":0.9}',
          parsedResponse: {
            intent: 'tenant.get_product',
            entities: {
              price: 'low',
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
            price: 'low',
          },
          language: 'es',
          confidence: 0.9,
        },
        usedFallback: false,
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
          entities: {},
          language: 'unknown',
          confidence: 0,
        },
        rawAiResponse: 'not-json',
        error: 'Unexpected token o in JSON at position 1',
        usedFallback: true,
      }),
    );
  });
});
