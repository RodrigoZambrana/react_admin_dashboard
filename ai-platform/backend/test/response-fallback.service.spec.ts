import { ResponseFallbackService } from '../src/modules/response-fallback/response-fallback.service';

describe('ResponseFallbackService', () => {
  it('renders fallback copy from the governed catalog instead of inline service strings', async () => {
    const service = new ResponseFallbackService(
      {
        resolveCatalog: jest.fn(async (locale?: string | null) => ({
          locale: locale?.startsWith('es') ? 'es' : 'default',
          templates: {
            basic_response:
              locale?.startsWith('es')
                ? 'Hola, ¿en qué puedo ayudarte?'
                : 'Hi, how can I help you?',
            clarification_requested_date: '',
            clarification_user_goal: '',
            clarification_generic: '',
            execution_success_booking:
              'The booking was confirmed for {{scheduledFor}}.',
            execution_success_quote: '',
            execution_success_product: '',
            execution_success_generic: '',
            execution_failure_unknown_tool: '',
            execution_failure_validation: '',
            execution_failure_generic: '',
          },
          templateVariants: {
            basic_response: locale?.startsWith('es')
              ? [
                  'Hola, ¿en qué puedo ayudarte?',
                  'Decime qué necesitás y te doy una mano.',
                ]
              : ['Hi, how can I help you?', "Tell me what you need and I'll take it from there."],
          },
          actionLabels: {
            create_booking: 'the requested booking',
            create_quote: 'the requested quote',
            get_product: 'the requested product lookup',
            default: 'the approved request',
          },
          defaults: {
            scheduledFor: 'the requested date',
            currency: 'USD',
            amount: '0.00',
            productName: 'the requested product',
          },
        })),
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(),
        createVersion: jest.fn(),
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.render({
        locale: 'es-UY',
        templateKey: 'basic_response',
        variationSeed: 'booking-seed',
      }),
    ).resolves.toMatch(/Hola|Decime/);

    await expect(
      service.render({
        locale: 'en',
        templateKey: 'execution_success_booking',
        variables: {
          scheduledFor: '2026-04-04T12:00:00.000Z',
        },
      }),
    ).resolves.toBe('The booking was confirmed for 2026-04-04T12:00:00.000Z.');
  });

  it('selects governed fallback variants deterministically from the resource catalog', async () => {
    const service = new ResponseFallbackService(
      {
        resolveCatalog: jest.fn(async () => ({
          locale: 'es',
          templates: {
            basic_response: 'Hola, ¿en qué puedo ayudarte?',
            clarification_requested_date: '',
            clarification_user_goal: '',
            clarification_generic: '',
            execution_success_booking: '',
            execution_success_quote: '',
            execution_success_product: '',
            execution_success_generic: '',
            execution_failure_unknown_tool: '',
            execution_failure_validation: '',
            execution_failure_generic: '',
          },
          templateVariants: {
            basic_response: [
              'Hola, ¿en qué puedo ayudarte?',
              'Decime qué necesitás y te doy una mano.',
              'Contame qué querés resolver y lo vemos.',
            ],
          },
          actionLabels: {
            create_booking: 'reserva',
            create_quote: 'cotización',
            get_product: 'producto',
            default: 'solicitud',
          },
          defaults: {
            scheduledFor: 'la fecha solicitada',
            currency: 'USD',
            amount: '0.00',
            productName: 'producto solicitado',
          },
        })),
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(),
        createVersion: jest.fn(),
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    const seeds = ['mensaje-uno', 'mensaje-dos', 'mensaje-tres', 'mensaje-cuatro'];
    const variantsBySeed = await Promise.all(
      seeds.map(async (seed) => ({
        seed,
        value: await service.render({
          locale: 'es',
          templateKey: 'basic_response',
          variationSeed: seed,
        }),
      })),
    );
    const repeated = await service.render({
      locale: 'es',
      templateKey: 'basic_response',
      variationSeed: seeds[0],
    });

    expect(new Set(variantsBySeed.map((item) => item.value)).size).toBeGreaterThan(1);
    expect(repeated).toBe(variantsBySeed[0].value);
  });

  it('promotes an existing fallback catalog through a governed activation path', async () => {
    const createVersion = jest.fn(async () => ({
      id: 'fallback-2',
      locale: 'es',
      version: 3,
      status: 'ACTIVE',
    }));
    const service = new ResponseFallbackService(
      {
        resolveCatalog: jest.fn(),
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(),
        findById: jest.fn(async () => ({
          id: 'fallback-1',
          locale: 'es',
          version: 2,
          status: 'DRAFT',
          resource: {
            locale: 'es',
            templates: {
              basic_response: 'Entiendo.',
              clarification_requested_date: 'Necesito una fecha.',
              clarification_user_goal: 'Contame brevemente qué necesitás.',
              clarification_generic: '¿Podés contarme un poco más?',
              execution_success_booking: 'Reserva creada.',
              execution_success_quote: 'Cotizacion creada.',
              execution_success_product: 'Producto encontrado.',
              execution_success_generic: 'Solicitud completada.',
              execution_failure_unknown_tool: 'No pude ejecutar esa accion.',
              execution_failure_validation: 'Faltan datos.',
              execution_failure_generic: 'No pude completar la solicitud.',
            },
            templateVariants: {
              basic_response: ['Entiendo.', 'Contame qué necesitás.'],
            },
            actionLabels: {
              create_booking: 'reserva',
              create_quote: 'cotizacion',
              get_product: 'producto',
              default: 'solicitud',
            },
            defaults: {
              scheduledFor: 'la fecha solicitada',
              currency: 'USD',
              amount: '0.00',
              productName: 'producto solicitado',
            },
          },
          metadata: {
            origin: 'admin',
          },
        })),
        createVersion,
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.activateVersion('fallback-1', 'admin-ui'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'fallback-2',
        status: 'ACTIVE',
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'es',
        activate: true,
        createdBy: 'admin-ui',
      }),
    );
  });

  it('uses the bootstrap compatibility boundary when an optional template is missing from the resolved catalog', async () => {
    const service = new ResponseFallbackService(
      {
        resolveCatalog: jest.fn(async () => ({
          locale: 'default',
          templates: {
            basic_response: 'Hi, how can I help you?',
            clarification_requested_date: '',
            clarification_user_goal: '',
            clarification_generic: '',
            execution_success_booking: '',
            execution_success_quote: '',
            execution_success_product: '',
            execution_success_generic: '',
            execution_failure_unknown_tool: '',
            execution_failure_validation: '',
            execution_failure_generic: '',
          },
          templateVariants: {},
          actionLabels: {
            create_booking: 'the requested booking',
            create_quote: 'the requested quote',
            get_product: 'the requested product lookup',
            default: 'the approved request',
          },
          defaults: {
            scheduledFor: 'the requested date',
            currency: 'USD',
            amount: '0.00',
            productName: 'the requested product',
          },
        })),
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(),
        createVersion: jest.fn(),
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.render({
        locale: 'es-UY',
        templateKey: 'document_not_found',
      }),
    ).resolves.toBe(
      'No tengo una confirmación clara sobre eso en este momento.',
    );
  });
});
