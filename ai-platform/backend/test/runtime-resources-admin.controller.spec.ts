import { RuntimeResourcesAdminController } from '../src/modules/api/runtime-resources-admin.controller';

describe('RuntimeResourcesAdminController', () => {
  it('exposes admin-ready surfaces for governed Wave 5 resource families', async () => {
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
        listConfigs: jest.fn(async () => ['config-version']),
        listActiveConfigs: jest.fn(async () => ['config-active']),
        createVersion: jest.fn(async () => ({ id: 'config-created' })),
      } as any,
      {
        listVersions: jest.fn(async () => ['knowledge-version']),
        listActiveResources: jest.fn(async () => ['knowledge-active']),
        createVersion: jest.fn(async () => ({ id: 'knowledge-created' })),
      } as any,
      {
        listVersions: jest.fn(async () => ['fallback-version']),
        listActiveCatalogs: jest.fn(async () => ['fallback-active']),
        createVersion: jest.fn(async () => ({ id: 'fallback-created' })),
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
  });
});
