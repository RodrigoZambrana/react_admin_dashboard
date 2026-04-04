import { ManagedCriticalConfigProvider } from '../src/modules/critical-config/managed-critical-config.provider';

describe('ManagedCriticalConfigProvider', () => {
  it('hydrates active critical configs from managed persistence after bootstrap seeding', async () => {
    const seedSource = {
      getSeed: async () => ({
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
      }),
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
      getSeed: jest.fn(async () => null),
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

  it('bootstrap-seeds a newly introduced critical-config key without resetting existing keys', async () => {
    const repository = buildRepository([
      {
        id: 'cfg-1',
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
        version: 1,
        status: 'ACTIVE',
        metadata: {
          origin: 'system',
        },
        createdAt: new Date(),
        createdBy: 'system',
      },
    ]);
    const seedSource = {
      getSeed: jest.fn(async (key: string) =>
        key === 'async_intake'
          ? {
              key: 'async_intake',
              value: {
                stabilization: {
                  defaultDelayMs: 900,
                  maxWindowMs: 2600,
                  fragmentContinuationDelayMs: 1700,
                  trailingThoughtDelayMs: 1500,
                  shortMessageDelayMs: 1300,
                  mediumIncompleteDelayMs: 1000,
                  longCompletedDelayMs: 350,
                  shortMessageLengthThreshold: 24,
                  mediumMessageLengthThreshold: 120,
                  longCompletedLengthThreshold: 50,
                },
                replyProjection: {
                  minDelayMs: 900,
                  maxDelayMs: 2600,
                  charDelayMs: 18,
                },
                lexicons: {
                  default: {
                    leadingTokens: [],
                    trailingTokens: [],
                    slotPatterns: [],
                  },
                },
              },
              createdBy: 'system:critical-config-seed',
              metadata: {
                origin: 'system' as const,
                source: 'env-seed',
              },
            }
          : null,
      ),
      listSeeds: jest.fn(async () => []),
    };
    const provider = new ManagedCriticalConfigProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('async_intake')).resolves.toEqual(
      expect.objectContaining({
        key: 'async_intake',
        value: expect.objectContaining({
          stabilization: expect.objectContaining({
            defaultDelayMs: 900,
          }),
        }),
      }),
    );
    expect(repository.hasVersionsForKey).toHaveBeenCalledWith('async_intake');
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'async_intake',
        activate: true,
      }),
    );
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
    hasVersionsForKey: jest.fn(
      async (key: string) => records.some((record) => record.key === key),
    ),
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
