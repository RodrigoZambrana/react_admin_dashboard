import { RuntimeResourcesAdminController } from '../src/modules/api/runtime-resources-admin.controller';

describe('RuntimeResourcesAdminController', () => {
  it('exposes admin-ready surfaces for governed Wave 5 resource families', async () => {
    const criticalConfigService = {
      listConfigs: jest.fn(async () => ['config-version']),
      listActiveConfigs: jest.fn(async () => ['config-active']),
      createVersion: jest.fn(async () => ({ id: 'config-created' })),
      activateVersion: jest.fn(async () => ({ id: 'config-activated' })),
    };
    const knowledgeMetadataService = {
      listVersions: jest.fn(async () => ['knowledge-version']),
      listActiveResources: jest.fn(async () => ['knowledge-active']),
      createVersion: jest.fn(async () => ({ id: 'knowledge-created' })),
      activateVersion: jest.fn(async () => ({ id: 'knowledge-activated' })),
    };
    const responseFallbackService = {
      listVersions: jest.fn(async () => ['fallback-version']),
      listActiveCatalogs: jest.fn(async () => ['fallback-active']),
      createVersion: jest.fn(async () => ({ id: 'fallback-created' })),
      activateVersion: jest.fn(async () => ({ id: 'fallback-activated' })),
    };
    const controller = new RuntimeResourcesAdminController(
      {
        listPrompts: jest.fn(async () => ['prompt-version']),
        listActivePrompts: jest.fn(async () => ['prompt-active']),
        createPromptVersion: jest.fn(async () => ({ id: 'prompt-created' })),
        activatePromptVersion: jest.fn(async () => ({ id: 'prompt-activated' })),
      } as any,
      {
        listVersions: jest.fn(async () => ['temporal-version']),
        listActiveLocales: jest.fn(async () => ['temporal-active']),
        createVersion: jest.fn(async () => ({ id: 'temporal-created' })),
        activateVersion: jest.fn(async () => ({ id: 'temporal-activated' })),
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

    await expect(
      controller.activatePromptVersion('prompt-1', {
        createdBy: 'admin-ui',
      }),
    ).resolves.toEqual({ id: 'prompt-activated' });
    await expect(
      controller.activateTemporalLocaleVersion('locale-1', {
        createdBy: 'admin-ui',
      }),
    ).resolves.toEqual({ id: 'temporal-activated' });
    await expect(
      controller.activateCriticalConfigVersion('config-1', {
        createdBy: 'admin-ui',
      }),
    ).resolves.toEqual({ id: 'config-activated' });
    await expect(
      controller.activateKnowledgeMetadataVersion('knowledge-1', {
        createdBy: 'admin-ui',
      }),
    ).resolves.toEqual({ id: 'knowledge-activated' });
    await expect(
      controller.activateResponseFallbackVersion('fallback-1', {
        createdBy: 'admin-ui',
      }),
    ).resolves.toEqual({ id: 'fallback-activated' });
  });
});
