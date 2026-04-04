import { AsyncTurnTimingPolicyService } from '../src/modules/api/async-turn-timing-policy.service';
import { buildDefaultAsyncIntakeRuntimeResource } from '../src/modules/critical-config/critical-config.types';

describe('AsyncTurnTimingPolicyService', () => {
  it('uses governed locale lexicons instead of inline timing heuristics', async () => {
    const config = buildDefaultAsyncIntakeRuntimeResource();
    config.stabilization.defaultDelayMs = 800;
    config.stabilization.fragmentContinuationDelayMs = 1900;
    config.lexicons.en = {
      leadingTokens: ['with'],
      trailingTokens: ['with'],
      slotPatterns: [],
    };
    const service = new AsyncTurnTimingPolicyService({
      getAsyncIntakeConfig: jest.fn(async () => config),
    } as any);

    await expect(
      service.calculateFlushAt({
        acceptedAt: new Date('2026-04-04T10:00:00.000Z'),
        messages: ['with anodized finish'],
        locale: 'en-US',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        stabilizationDelayMs: 1900,
      }),
    );
  });

  it('falls back to the default lexicon when the locale-specific entry is absent', async () => {
    const config = buildDefaultAsyncIntakeRuntimeResource();
    config.stabilization.fragmentContinuationDelayMs = 1800;
    const service = new AsyncTurnTimingPolicyService({
      getAsyncIntakeConfig: jest.fn(async () => config),
    } as any);

    await expect(
      service.calculateFlushAt({
        acceptedAt: new Date('2026-04-04T10:00:00.000Z'),
        messages: ['1,20 x 0,80'],
        locale: 'pt-BR',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        stabilizationDelayMs: 1800,
      }),
    );
  });

  it('uses governed reply-projection bounds instead of inline constants', async () => {
    const config = buildDefaultAsyncIntakeRuntimeResource();
    config.replyProjection.minDelayMs = 500;
    config.replyProjection.maxDelayMs = 1100;
    config.replyProjection.charDelayMs = 50;
    const service = new AsyncTurnTimingPolicyService({
      getAsyncIntakeConfig: jest.fn(async () => config),
    } as any);

    await expect(service.estimateReplyDelay('ok')).resolves.toBe(600);
    await expect(
      service.estimateReplyDelay(
        'respuesta suficientemente larga para alcanzar el maximo configurado',
      ),
    ).resolves.toBe(1100);
  });
});
