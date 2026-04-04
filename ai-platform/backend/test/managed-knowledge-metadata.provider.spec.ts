import { ManagedKnowledgeMetadataProvider } from '../src/modules/knowledge-metadata/managed-knowledge-metadata.provider';

describe('ManagedKnowledgeMetadataProvider', () => {
  it('hydrates active knowledge metadata resources from managed persistence after bootstrap seeding', async () => {
    const seedSource = {
      listSeeds: async () => [
        {
          key: 'default',
          value: {
            enabledStages: ['execution'],
            metadataAllowList: ['toolName'],
            stagePolicies: {
              execution: {
                enabled: true,
                minConfidence: 0.7,
                defaultTags: ['execution'],
              },
            },
          },
          createdBy: 'system:knowledge-metadata-seed',
          metadata: {
            origin: 'seed' as const,
            source: 'filesystem',
          },
        },
      ],
    };
    const repository = buildRepository();
    const provider = new ManagedKnowledgeMetadataProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('default')).resolves.toEqual(
      expect.objectContaining({
        key: 'default',
        value: expect.objectContaining({
          enabledStages: ['execution'],
        }),
      }),
    );
    expect(repository.createVersion).toHaveBeenCalledTimes(1);
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'default',
        activate: true,
      }),
    );
  });

  it('reuses managed knowledge metadata without consulting bootstrap seeds again', async () => {
    const repository = buildRepository([
      {
        id: 'meta-1',
        key: 'default',
        resource: {
          enabledStages: ['execution', 'response'],
          metadataAllowList: ['toolName'],
          stagePolicies: {
            response: {
              enabled: true,
              minConfidence: 0.6,
              defaultTags: ['response'],
            },
          },
        },
        version: 3,
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
    const provider = new ManagedKnowledgeMetadataProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('default')).resolves.toEqual(
      expect.objectContaining({
        key: 'default',
        value: expect.objectContaining({
          enabledStages: ['execution', 'response'],
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
        key: string;
        resource: Record<string, unknown>;
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
          id: `knowledge-metadata-${key}-${version}`,
          key,
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
    getActiveByKey: jest.fn(async (key: string) =>
      records.find(
        (record) => record.key === key && record.status === 'ACTIVE',
      ) ?? null,
    ),
  };
}
