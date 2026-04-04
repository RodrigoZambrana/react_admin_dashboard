import { AdminTestCenterController } from '../src/modules/api/admin-test-center.controller';

describe('AdminTestCenterController', () => {
  it('exposes replay, trace exploration, and comparison contracts', async () => {
    const service = {
      listTestRuns: jest.fn(async () => ['run-1']),
      getTestRun: jest.fn(async () => ({ id: 'conv-1' })),
      listRecentTraceSummaries: jest.fn(async () => ['trace-1']),
      getTraceDetail: jest.fn(async () => ({ summary: { traceId: 'trace-1' } })),
      compareTraces: jest.fn(async () => ({ comparison: {} })),
      replayConversation: jest.fn(async () => ({ conversationId: 'conv-1' })),
    };
    const controller = new AdminTestCenterController(service as any);

    await expect(controller.listTestRuns('10')).resolves.toEqual(['run-1']);
    await expect(controller.getTestRun('conv-1')).resolves.toEqual({
      id: 'conv-1',
    });
    await expect(controller.listRecentTraces('5')).resolves.toEqual(['trace-1']);
    await expect(controller.getTraceDetail('trace-1')).resolves.toEqual({
      summary: { traceId: 'trace-1' },
    });
    await expect(
      controller.compareTraces({
        leftTraceId: 'trace-1',
        rightTraceId: 'trace-2',
      } as any),
    ).resolves.toEqual({ comparison: {} });
    await expect(
      controller.replayConversation({
        turns: [{ message: 'hola' }],
      } as any),
    ).resolves.toEqual({ conversationId: 'conv-1' });
  });
});
