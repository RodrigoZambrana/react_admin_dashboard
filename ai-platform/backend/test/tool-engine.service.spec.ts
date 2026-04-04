import { z } from 'zod';

import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { CreateBookingTool } from '../src/modules/tools/create-booking.tool';
import { CreateQuoteTool } from '../src/modules/tools/create-quote.tool';
import { GetProductTool } from '../src/modules/tools/get-product.tool';
import { ProductCatalogService } from '../src/modules/tools/product-catalog.service';
import { ToolEngineService } from '../src/modules/tools/tool-engine.service';

describe('ToolEngineService', () => {
  function createService() {
    const productCatalogService = {
      findMatch: jest.fn(async (input: { sku?: string; query?: string | null }) => {
        const query = input.query?.trim().toLowerCase() ?? '';

        if (
          input.sku?.trim().toLowerCase() === 'b-77' ||
          query.includes('beacon desk lamp')
        ) {
          return {
            matched: true as const,
            matchedBy: input.sku ? ('sku' as const) : ('query' as const),
            score: 95,
            product: {
              id: 'prod-beacon',
              sourceId: 'catalog-upload-1',
              sourceKind: 'UPLOADED_STRUCTURED',
              sourceTitle: 'Lighting Catalog',
              sku: 'B-77',
              name: 'Beacon Desk Lamp',
              price: 89,
              currency: 'USD',
              availability: 'backorder',
              attributes: {},
            },
          };
        }

        return {
          matched: false as const,
          matchedBy: null,
          product: null,
          score: 0,
        };
      }),
    } as unknown as ProductCatalogService;

    return new ToolEngineService(
      new PipelineLoggerService(),
      new CreateBookingTool(),
      new GetProductTool(productCatalogService),
      new CreateQuoteTool(),
    );
  }

  it('validates and executes the booking tool', async () => {
    const service = createService();

    const result = await service.execute('create_booking', {
      interpretation: {
        intent: 'CREATE_BOOKING',
        language: 'es',
        confidence: 0.93,
        entities: {
          rawMessage: 'Reservar para 2 personas mañana',
          attendees: 2,
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
      tenantId: 'tenant-alpha',
      traceId: 'trace-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        toolName: 'create_booking',
        payload: expect.objectContaining({
          status: 'confirmed',
          attendees: 2,
        }),
      }),
    );
  });

  it('prefers a continuity-carried booking summary over a date-only follow-up when building booking notes', async () => {
    const service = createService();

    const result = await service.execute('create_booking', {
      interpretation: {
        intent: 'CREATE_BOOKING',
        language: 'es',
        confidence: 0.91,
        entities: {
          rawMessage: 'mañana a las 11',
          requestSummary:
            'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
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
      tenantId: 'tenant-alpha',
      traceId: 'trace-booking-summary',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          notes:
            'Necesito agendar una visita para cambiar la cadena de una cortina roller.',
          scheduledFor: '2026-04-04T11:00:00.000Z',
        }),
      }),
    );
  });

  it('validates and executes the quote tool', async () => {
    const service = createService();

    const result = await service.execute('create_quote', {
      interpretation: {
        intent: 'CREATE_QUOTE',
        language: 'es',
        confidence: 0.91,
        entities: {
          rawMessage: 'Necesito una cotizacion para 3 puertas',
          attendees: 2,
        },
        normalizedEntities: {
          dates: [],
          measurements: [
            {
              source: '2 m',
              value: 2,
              unit: 'm',
              normalizedValue: 2,
              normalizedUnit: 'm',
              kind: 'length',
            },
          ],
          dimensions: [],
        },
      },
      tenantId: 'tenant-alpha',
      traceId: 'trace-quote',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        toolName: 'create_quote',
        payload: expect.objectContaining({
          status: 'drafted',
          currency: 'USD',
        }),
      }),
    );
  });

  it('validates and executes the product tool', async () => {
    const service = createService();

    const result = await service.execute('get_product', {
      interpretation: {
        intent: 'GET_PRODUCT',
        language: 'en',
        confidence: 0.88,
        entities: {
          rawMessage: 'I need a Beacon Desk Lamp',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      tenantId: 'tenant-alpha',
      traceId: 'trace-product',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        toolName: 'get_product',
        payload: expect.objectContaining({
          sku: 'B-77',
          name: 'Beacon Desk Lamp',
        }),
      }),
    );
  });

  it('fails safely when a tool name is unknown', async () => {
    const service = createService();

    await expect(
      service.execute('missing_tool', {
        interpretation: {
          intent: 'GET_PRODUCT',
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage: 'consulta',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        tenantId: 'tenant-alpha',
        traceId: 'trace-unknown',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        toolName: 'missing_tool',
        errorCode: 'unknown_tool',
      }),
    );
  });

  it('fails safely when tool input validation fails', async () => {
    const service = createService();

    await expect(
      service.execute('create_booking', {
        interpretation: {
          intent: 'CREATE_BOOKING',
          language: 'es',
          confidence: 0.93,
          entities: {
            rawMessage: 'Reservar',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        tenantId: 'tenant-alpha',
        traceId: 'trace-validation',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        toolName: 'create_booking',
        errorCode: 'validation_failed',
      }),
    );
  });

  it('fails safely when the tool implementation throws', async () => {
    const service = createService();
    (service as any).tools.set('explode_tool', {
      name: 'explode_tool',
      schema: z.object({
        note: z.string().min(1),
      }),
      buildInput: () => ({
        note: 'explode',
      }),
      execute: async () => {
        throw new Error('Exploded');
      },
    });

    await expect(
      service.execute('explode_tool', {
        interpretation: {
          intent: 'GENERAL_CONVERSATION',
          language: 'en',
          confidence: 0.8,
          entities: {
            rawMessage: 'explode',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        tenantId: 'tenant-alpha',
        traceId: 'trace-execution-failure',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        toolName: 'explode_tool',
        errorCode: 'execution_failed',
        validatedInput: {
          note: 'explode',
        },
      }),
    );
  });

  it('fails closed when the product lookup has no grounded catalog match', async () => {
    const service = createService();

    await expect(
      service.execute('get_product', {
        interpretation: {
          intent: 'GET_PRODUCT',
          language: 'es',
          confidence: 0.86,
          entities: {
            rawMessage: 'necesito algo lindo para el living',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        tenantId: 'tenant-alpha',
        traceId: 'trace-product-no-match',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        toolName: 'get_product',
        errorCode: 'not_found',
      }),
    );
  });
});
