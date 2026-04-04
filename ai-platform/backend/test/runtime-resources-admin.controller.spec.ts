import { RuntimeResourcesAdminController } from '../src/modules/api/runtime-resources-admin.controller';

describe('RuntimeResourcesAdminController', () => {
  it('exposes admin-ready surfaces for governed Wave 5 resource families', async () => {
    const criticalConfigService = {
      listConfigs: jest.fn(async () => ['config-version']),
      listActiveConfigs: jest.fn(async () => ['config-active']),
      createVersion: jest.fn(async () => ({ id: 'config-created' })),
    };
    const knowledgeMetadataService = {
      listVersions: jest.fn(async () => ['knowledge-version']),
      listActiveResources: jest.fn(async () => ['knowledge-active']),
      createVersion: jest.fn(async () => ({ id: 'knowledge-created' })),
    };
    const responseFallbackService = {
      listVersions: jest.fn(async () => ['fallback-version']),
      listActiveCatalogs: jest.fn(async () => ['fallback-active']),
      createVersion: jest.fn(async () => ({ id: 'fallback-created' })),
    };
    const controller = new RuntimeResourcesAdminController(
      {
        listPrompts: jest.fn(async () => ['prompt-version']),
        listActivePrompts: jest.fn(async () => ['prompt-active']),
        createPromptVersion: jest.fn(async () => ({ id: 'prompt-created' })),
      } as any,
      {
        listVersions: jest.fn(async () => ['temporal-version']),
        listActiveLocales: jest.fn(async () => ['temporal-active']),
        createVersion: jest.fn(async () => ({ id: 'temporal-created' })),
      } as any,
      {
        ...criticalConfigService,
      } as any,
      {
        ...knowledgeMetadataService,
      } as any,
      {
        ...responseFallbackService,
      } as any,
    );

    await expect(controller.listCriticalConfigVersions('learning')).resolves.toEqual([
      'config-version',
    ]);
    await expect(controller.listActiveCriticalConfigs()).resolves.toEqual([
      'config-active',
    ]);
    await expect(
      controller.listKnowledgeMetadataVersions('default'),
    ).resolves.toEqual(['knowledge-version']);
    await expect(controller.listActiveKnowledgeMetadata()).resolves.toEqual([
      'knowledge-active',
    ]);
    await expect(controller.listResponseFallbackVersions('es')).resolves.toEqual([
      'fallback-version',
    ]);
    await expect(controller.listActiveResponseFallbacks()).resolves.toEqual([
      'fallback-active',
    ]);

    await expect(
      controller.createCriticalConfigVersion({
        key: 'learning',
        value: {
          enabled: true,
        },
      } as any),
    ).resolves.toEqual({ id: 'config-created' });
    expect(criticalConfigService.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'learning',
      }),
    );

    await expect(
      controller.createKnowledgeMetadataVersion({
        key: 'default',
        resource: {
          enabledStages: ['execution'],
        },
      } as any),
    ).resolves.toEqual({ id: 'knowledge-created' });
    expect(knowledgeMetadataService.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'default',
      }),
    );
  });
});
