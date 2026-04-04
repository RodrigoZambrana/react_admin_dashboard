import { TraceLogService } from '../src/modules/api/trace-log.service';

describe('TraceLogService', () => {
  it('enqueues learning from persisted non-learning stages only after the log is stored', async () => {
    const createLog = jest.fn(async () => ({
      id: 'log-1',
      traceId: 'trace-1',
      stage: 'response',
      status: 'completed',
    }));
    const enqueueLog = jest.fn();
    const service = new TraceLogService(
      {
        getTraceId: () => 'trace-1',
        getTenantId: () => 'tenant-alpha',
      } as any,
      {
        createLog,
      } as any,
      {
        enqueueLog,
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await service.recordStage({
      conversationId: 'conv-1',
      stage: 'response',
      status: 'completed',
      payload: {
        response: 'Hello',
      } as any,
    });

    expect(createLog).toHaveBeenCalled();
    expect(enqueueLog).toHaveBeenCalledWith({
      logId: 'log-1',
      tenantId: 'tenant-alpha',
      traceId: 'trace-1',
    });
  });

  it('does not enqueue learning when the recorded stage is already learning', async () => {
    const enqueueLog = jest.fn();
    const service = new TraceLogService(
      {
        getTraceId: () => 'trace-2',
        getTenantId: () => 'tenant-alpha',
      } as any,
      {
        createLog: jest.fn(async () => ({
          id: 'learning-log',
          traceId: 'trace-2',
          stage: 'learning',
          status: 'completed',
        })),
      } as any,
      {
        enqueueLog,
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await service.recordStage({
      conversationId: 'conv-1',
      stage: 'learning',
      status: 'completed',
      payload: {
        sourceLogId: 'log-1',
      } as any,
    });

    expect(enqueueLog).not.toHaveBeenCalled();
  });
});
