import { ManagedResponseFallbackProvider } from '../src/modules/response-fallback/managed-response-fallback.provider';

describe('ManagedResponseFallbackProvider', () => {
  it('hydrates active fallback catalogs from managed persistence after bootstrap seeding', async () => {
    const seedSource = {
      listSeeds: async () => [
        {
          key: 'default',
          value: buildCatalog('default'),
          createdBy: 'system:response-fallback-seed',
          metadata: {
            origin: 'seed' as const,
            source: 'filesystem',
          },
        },
        {
          key: 'es',
          value: buildCatalog('es'),
          createdBy: 'system:response-fallback-seed',
          metadata: {
            origin: 'seed' as const,
            source: 'filesystem',
          },
        },
      ],
    };
    const repository = buildRepository();
    const provider = new ManagedResponseFallbackProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.resolveCatalog('es-UY')).resolves.toEqual(
      expect.objectContaining({
        locale: 'es',
      }),
    );
    expect(repository.createVersion).toHaveBeenCalledTimes(2);
  });

  it('reuses managed fallback catalogs without creating bootstrap versions again', async () => {
    const repository = buildRepository([
      {
        id: 'fallback-en-1',
        locale: 'en',
        resource: buildCatalog('en'),
        version: 1,
        status: 'ACTIVE',
        metadata: {
          origin: 'admin',
        },
        createdAt: new Date(),
        createdBy: 'admin',
      },
    ]);
    const seedSource = {
      listSeeds: jest.fn(async () => []),
    };
    const provider = new ManagedResponseFallbackProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.resolveCatalog('en')).resolves.toEqual(
      expect.objectContaining({
        locale: 'en',
      }),
    );
    expect(seedSource.listSeeds).toHaveBeenCalledTimes(1);
    expect(repository.createVersion).not.toHaveBeenCalled();
  });

  it('merges active managed catalogs with seeded defaults when new templates are missing', async () => {
    const repository = buildRepository([
      {
        id: 'fallback-es-1',
        locale: 'es',
        resource: {
          locale: 'es',
          templates: {
            basic_response: 'Hola, contame en qué te puedo ayudar.',
            clarification_requested_date:
              'Necesito la fecha deseada para continuar.',
            clarification_user_goal:
              'Necesito entender mejor lo que necesitás para continuar.',
            clarification_generic: 'Necesito un poco más de contexto.',
            execution_success_booking:
              'La reserva fue confirmada para {{scheduledFor}}.',
            execution_success_quote:
              'La cotización preliminar fue creada por {{currency}} {{estimatedTotal}}.',
            execution_success_product:
              'Encontré {{name}} por {{currency}} {{price}}.',
            execution_success_generic:
              'La acción solicitada se ejecutó correctamente.',
            execution_failure_unknown_tool:
              'No pude completar {{actionLabel}} porque la capacidad aprobada no está disponible.',
            execution_failure_validation:
              'No pude completar {{actionLabel}} con la información disponible.',
            execution_failure_generic:
              'No pude completar {{actionLabel}} por un error durante la ejecución.',
          },
          actionLabels: buildCatalog('es').actionLabels,
          defaults: buildCatalog('es').defaults,
        },
        version: 1,
        status: 'ACTIVE',
        metadata: {
          origin: 'admin',
        },
        createdAt: new Date(),
        createdBy: 'admin',
      },
    ]);
    const seedSource = {
      listSeeds: jest.fn(async () => [
        {
          key: 'default',
          value: buildCatalog('default'),
          createdBy: 'system:response-fallback-seed',
          metadata: {
            origin: 'seed' as const,
            source: 'filesystem',
          },
        },
        {
          key: 'es',
          value: buildCatalog('es'),
          createdBy: 'system:response-fallback-seed',
          metadata: {
            origin: 'seed' as const,
            source: 'filesystem',
          },
        },
      ]),
    };
    const provider = new ManagedResponseFallbackProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.resolveCatalog('es')).resolves.toEqual(
      expect.objectContaining({
        locale: 'es',
        templates: expect.objectContaining({
          clarification_quote_scope: expect.any(String),
        }),
      }),
    );
  });
});

function buildCatalog(locale: string) {
  return {
    locale,
    templates: {
      basic_response: locale === 'es' ? 'Entiendo. Como puedo ayudarte?' : 'Hello, how can I help you?',
      clarification_requested_date:
        locale === 'es'
          ? 'Necesito la fecha deseada para continuar.'
          : 'I need the requested date to continue.',
      clarification_quote_scope:
        locale === 'es'
          ? 'Necesito saber qué producto o línea querés cotizar.'
          : 'I need to know which product or line you want to quote.',
      clarification_user_goal:
        locale === 'es'
          ? 'Necesito entender mejor lo que necesitas para continuar.'
          : 'I need to better understand what you need to continue.',
      clarification_generic:
        locale === 'es'
          ? 'Necesito un poco mas de contexto para continuar.'
          : 'I need a bit more context to continue.',
      execution_success_booking:
        locale === 'es'
          ? 'La reserva fue confirmada para {{scheduledFor}}.'
          : 'The booking was confirmed for {{scheduledFor}}.',
      execution_success_quote:
        locale === 'es'
          ? 'La cotizacion preliminar fue creada por {{currency}} {{estimatedTotal}}.'
          : 'The preliminary quote was created for {{currency}} {{estimatedTotal}}.',
      execution_success_product:
        locale === 'es'
          ? 'Encontre {{name}} por {{currency}} {{price}}.'
          : 'I found {{name}} for {{currency}} {{price}}.',
      execution_success_generic:
        locale === 'es'
          ? 'La accion solicitada fue ejecutada correctamente.'
          : 'The requested action was executed successfully.',
      execution_failure_unknown_tool:
        locale === 'es'
          ? 'No pude completar {{actionLabel}} porque la capacidad aprobada no esta disponible.'
          : 'I could not complete {{actionLabel}} because the approved capability is not available.',
      execution_failure_validation:
        locale === 'es'
          ? 'No pude completar {{actionLabel}} con la informacion disponible.'
          : 'I could not complete {{actionLabel}} with the available information.',
      execution_failure_generic:
        locale === 'es'
          ? 'No pude completar {{actionLabel}} por un error durante la ejecucion.'
          : 'I could not complete {{actionLabel}} because of an execution error.',
    },
    actionLabels: {
      create_booking:
        locale === 'es' ? 'la reserva solicitada' : 'the requested booking',
      create_quote:
        locale === 'es' ? 'la cotizacion solicitada' : 'the requested quote',
      get_product:
        locale === 'es'
          ? 'la consulta de producto solicitada'
          : 'the requested product lookup',
      default: locale === 'es' ? 'la solicitud aprobada' : 'the approved request',
    },
    defaults: {
      scheduledFor:
        locale === 'es' ? 'la fecha solicitada' : 'the requested date',
      currency: 'USD',
      amount: '0.00',
      productName:
        locale === 'es' ? 'el producto solicitado' : 'the requested product',
    },
  };
}

function buildRepository(
  initialRecords: Array<{
    id: string;
    locale: string;
    resource: Record<string, unknown>;
    version: number;
    status: string;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    createdBy: string | null;
  }> = [],
) {
  const records = [...initialRecords];

  return {
    createVersion: jest.fn(
      async (input: {
        locale: string;
        resource: Record<string, unknown>;
        createdBy?: string;
        metadata?: Record<string, unknown>;
        activate?: boolean;
      }) => {
        const version =
          records.filter((record) => record.locale === input.locale).length + 1;

        if (input.activate) {
          for (const record of records) {
            if (record.locale === input.locale && record.status === 'ACTIVE') {
              record.status = 'ARCHIVED';
            }
          }
        }

        const record = {
          id: `response-fallback-${input.locale}-${version}`,
          locale: input.locale,
          resource: input.resource,
          version,
          status: input.activate ? 'ACTIVE' : 'DRAFT',
          metadata: input.metadata ?? null,
          createdAt: new Date(),
          createdBy: input.createdBy ?? null,
        };
        records.push(record);
        return record;
      },
    ),
    hasAnyVersions: jest.fn(async () => records.length > 0),
    listActive: jest.fn(async () =>
      records.filter((record) => record.status === 'ACTIVE'),
    ),
    getActiveByLocale: jest.fn(async (locale: string) =>
      records.find(
        (record) => record.locale === locale && record.status === 'ACTIVE',
      ) ?? null,
    ),
  };
}
