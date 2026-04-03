import { ManagedPromptTemplateProvider } from '../src/modules/prompt/managed-prompt-template.provider';

describe('ManagedPromptTemplateProvider', () => {
  it('hydrates active prompts from managed persistence after bootstrap seeding', async () => {
    const seedSource = {
      listSeeds: async () => [
        {
          key: 'interpretation',
          value: 'Return JSON only.',
          createdBy: 'system:prompt-seed',
          metadata: {
            origin: 'seed' as const,
            source: 'filesystem',
          },
        },
      ],
    };
    const repository = buildRepository();
    const provider = new ManagedPromptTemplateProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('interpretation')).resolves.toEqual(
      expect.objectContaining({
        key: 'interpretation',
        value: 'Return JSON only.',
      }),
    );
    expect(repository.createVersion).toHaveBeenCalledTimes(1);
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'interpretation',
        activate: true,
      }),
    );
  });

  it('reuses managed prompt versions without consulting bootstrap seeds again', async () => {
    const repository = buildRepository([
      {
        id: 'prompt-1',
        key: 'response',
        template: 'Managed response prompt.',
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
    const provider = new ManagedPromptTemplateProvider(
      repository as any,
      seedSource as any,
    );

    await expect(provider.getActive('response')).resolves.toEqual(
      expect.objectContaining({
        key: 'response',
        value: 'Managed response prompt.',
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
    template: string;
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
        template: string;
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
          id: `prompt-${key}-${version}`,
          key,
          template: input.template,
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
