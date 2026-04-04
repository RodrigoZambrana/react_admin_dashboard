import { ZodError } from 'zod';

import { KnowledgeMetadataService } from '../src/modules/knowledge-metadata/knowledge-metadata.service';

describe('KnowledgeMetadataService', () => {
  it('accepts a valid knowledge metadata policy before persistence', async () => {
    const createVersion = jest.fn(async () => ({
      key: 'default',
      version: 1,
      status: 'ACTIVE',
    }));
    const service = new KnowledgeMetadataService(
      {
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(async () => []),
        createVersion,
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.createVersion({
        key: 'default',
        resource: {
          enabledStages: ['execution', 'response'],
          metadataAllowList: ['sku', 'category'],
          stagePolicies: {
            execution: {
              enabled: true,
              minConfidence: 0.7,
              defaultTags: ['approved'],
            },
          },
        },
        activate: true,
        createdBy: 'admin',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        key: 'default',
        version: 1,
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'default',
        activate: true,
      }),
    );
  });

  it('rejects malformed knowledge metadata before the repository is called', async () => {
    const createVersion = jest.fn();
    const service = new KnowledgeMetadataService(
      {
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(async () => []),
        createVersion,
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.createVersion({
        key: 'default',
        resource: {
          enabledStages: [],
          metadataAllowList: ['sku'],
          stagePolicies: {},
        } as any,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(createVersion).not.toHaveBeenCalled();
  });

  it('promotes existing knowledge metadata through a governed activation path', async () => {
    const createVersion = jest.fn(async () => ({
      id: 'knowledge-2',
      key: 'default',
      version: 2,
      status: 'ACTIVE',
    }));
    const service = new KnowledgeMetadataService(
      {
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(async () => []),
        findById: jest.fn(async () => ({
          id: 'knowledge-1',
          key: 'default',
          version: 1,
          status: 'DRAFT',
          resource: {
            enabledStages: ['execution', 'response'],
            metadataAllowList: ['sku'],
            stagePolicies: {
              execution: {
                enabled: true,
                minConfidence: 0.7,
                defaultTags: ['approved'],
              },
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
      service.activateVersion('knowledge-1', 'admin-ui'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'knowledge-2',
        status: 'ACTIVE',
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'default',
        activate: true,
        createdBy: 'admin-ui',
      }),
    );
  });
});
