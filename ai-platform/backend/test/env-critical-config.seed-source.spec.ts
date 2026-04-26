import { EnvCriticalConfigSeedSource } from '../src/modules/critical-config/env-critical-config.seed-source';

describe('EnvCriticalConfigSeedSource', () => {
  it('bootstraps ai_runtime to OpenAI exploratory defaults when OPENAI_API_KEY is present', async () => {
    const source = new EnvCriticalConfigSeedSource(
      {
        get: jest.fn((key: string) =>
          key === 'OPENAI_API_KEY' ? 'secret-key' : undefined,
        ),
      } as any,
    );

    await expect(source.getSeed('ai_runtime')).resolves.toEqual(
      expect.objectContaining({
        key: 'ai_runtime',
        value: expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4.1-mini',
          timeoutMs: 7000,
          credentials: {
            strategy: 'env',
            envKey: 'OPENAI_API_KEY',
          },
        }),
      }),
    );
  });

  it('ignores legacy mock provider overrides at the env bootstrap edge', async () => {
    const source = new EnvCriticalConfigSeedSource(
      {
        get: jest.fn((key: string) => {
          if (key === 'AI_PROVIDER') {
            return 'mock';
          }

          if (key === 'OPENAI_API_KEY') {
            return 'secret-key';
          }

          return undefined;
        }),
      } as any,
    );

    await expect(source.getSeed('ai_runtime')).resolves.toEqual(
      expect.objectContaining({
        value: expect.objectContaining({
          provider: 'openai',
          credentials: {
            strategy: 'env',
            envKey: 'OPENAI_API_KEY',
          },
        }),
      }),
    );
  });
});
