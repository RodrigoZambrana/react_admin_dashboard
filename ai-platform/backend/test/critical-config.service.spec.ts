import { ZodError } from 'zod';

import { CriticalConfigService } from '../src/modules/critical-config/critical-config.service';

describe('CriticalConfigService', () => {
  it('accepts a valid ai_runtime config before persistence', async () => {
    const createVersion = jest.fn(async () => ({
      key: 'ai_runtime',
      version: 1,
      status: 'ACTIVE',
    }));
    const service = new CriticalConfigService(
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
        key: 'ai_runtime',
        value: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          timeoutMs: 7000,
          credentials: {
            strategy: 'env',
            envKey: 'AI_PROVIDER_API_KEY',
          },
          providerOptions: {
            baseUrl: 'https://provider.internal/v1',
          },
        },
        activate: true,
        createdBy: 'admin',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        key: 'ai_runtime',
        version: 1,
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ai_runtime',
        activate: true,
      }),
    );
  });

  it('accepts a valid learning config before persistence', async () => {
    const createVersion = jest.fn(async () => ({
      key: 'learning',
      version: 1,
      status: 'ACTIVE',
    }));
    const service = new CriticalConfigService(
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
        key: 'learning',
        value: {
          enabled: true,
          observedStages: ['execution', 'response'],
          minConfidence: 0.6,
          maxBodyLength: 240,
          maxSummaryLength: 180,
          persistEmbeddings: true,
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        key: 'learning',
        version: 1,
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'learning',
      }),
    );
  });

  it('accepts a valid async_intake config before persistence', async () => {
    const createVersion = jest.fn(async () => ({
      key: 'async_intake',
      version: 1,
      status: 'ACTIVE',
    }));
    const service = new CriticalConfigService(
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
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        key: 'async_intake',
        version: 1,
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'async_intake',
      }),
    );
  });

  it('rejects malformed critical configs before the repository is called', async () => {
    const createVersion = jest.fn();
    const service = new CriticalConfigService(
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
        key: 'ai_runtime',
        value: {
          provider: 'openai',
          model: '',
          timeoutMs: 0,
          credentials: {
            strategy: 'env',
          },
          providerOptions: {},
        } as any,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(createVersion).not.toHaveBeenCalled();
  });

  it('promotes an existing critical config through a governed activation path', async () => {
    const createVersion = jest.fn(async () => ({
      id: 'config-2',
      key: 'learning',
      version: 3,
      status: 'ACTIVE',
    }));
    const service = new CriticalConfigService(
      {
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(async () => []),
        findById: jest.fn(async () => ({
          id: 'config-1',
          key: 'learning',
          version: 2,
          status: 'DRAFT',
          value: {
            enabled: true,
            observedStages: ['execution', 'response'],
            minConfidence: 0.6,
            maxBodyLength: 240,
            maxSummaryLength: 180,
            persistEmbeddings: true,
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

    await expect(service.activateVersion('config-1', 'admin-ui')).resolves.toEqual(
      expect.objectContaining({
        id: 'config-2',
        status: 'ACTIVE',
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'learning',
        activate: true,
        createdBy: 'admin-ui',
      }),
    );
  });
});
