import { ManagedCriticalConfigProvider } from '../src/modules/critical-config/managed-critical-config.provider';

describe('ManagedCriticalConfigProvider', () => {
  it('hydrates active critical configs from managed persistence after bootstrap seeding', async () => {
    const seedSource = {
      listSeeds: async () => [
        {
          key: 'ai_runtime',
          value: {
            provider: 'mock',
            model: 'mock-rule-engine',
            timeoutMs: 1000,
            credentials: {
              strategy: 'none',
              envKey: null,
            },
            providerOptions: {},
          },
          createdBy: 'system:critical-config-seed',
          metadata: {
            origin: 'system' as const,
            source: 'env-seed',
          },
        },
      ],
    };
    const repository = buildRepository();
    const provider = new ManagedCriticalConfigProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('ai_runtime')).resolves.toEqual(
      expect.objectContaining({
        key: 'ai_runtime',
        value: expect.objectContaining({
          provider: 'mock',
        }),
      }),
    );
    expect(repository.createVersion).toHaveBeenCalledTimes(1);
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ai_runtime',
        activate: true,
      }),
    );
  });

  it('reuses managed critical config versions without consulting bootstrap seeds again', async () => {
    const repository = buildRepository([
      {
        id: 'cfg-1',
        key: 'learning',
        value: {
          enabled: true,
          observedStages: ['execution', 'response'],
          minConfidence: 0.6,
          maxBodyLength: 240,
          maxSummaryLength: 180,
          persistEmbeddings: true,
        },
        version: 2,
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
    const provider = new ManagedCriticalConfigProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('learning')).resolves.toEqual(
      expect.objectContaining({
        key: 'learning',
        value: expect.objectContaining({
          enabled: true,
        }),
      }),
    );
    expect(seedSource.listSeeds).not.toHaveBeenCalled();
    expect(repository.createVersion).not.toHaveBeenCalled();
  });
});

function buildRepository(
  initialRecords: Array<{
    id: string;
    key: string;
    value: Record<string, unknown>;
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
        key: string;
        value: Record<string, unknown>;
        createdBy?: string;
        metadata?: Record<string, unknown>;
        activate?: boolean;
      }) => {
        const key = input.key;
        const version = records.filter((record) => record.key === key).length + 1;

        if (input.activate) {
          for (const record of records) {
            if (record.key === key && record.status === 'ACTIVE') {
              record.status = 'ARCHIVED';
            }
          }
        }

        const record = {
          id: `critical-config-${key}-${version}`,
          key,
          value: input.value,
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
    getActiveByKey: jest.fn(async (key: string) =>
      records.find(
        (record) => record.key === key && record.status === 'ACTIVE',
      ) ?? null,
    ),
  };
}
