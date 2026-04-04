import { LearningService } from '../src/modules/knowledge/learning.service';

describe('LearningService', () => {
  it('extracts governed knowledge from a persisted execution log and records a learning trace', async () => {
    const createLog = jest.fn(async (input: any) => ({
      id: 'learning-log-1',
      ...input,
    }));
    const service = new LearningService(
      {
        getTenantId: () => 'tenant-alpha',
        run: async (
          _context: { tenantId: string; traceId: string },
          callback: () => Promise<void>,
        ) => callback(),
      } as any,
      {
        findById: jest.fn(async () => ({
          id: 'log-1',
          conversationId: 'conv-1',
          traceId: 'trace-1',
          stage: 'execution',
          status: 'completed',
          payload: {
            toolName: 'create_booking',
            output: {
              bookingId: 'bk_123',
            },
          },
        })),
        createLog,
      } as any,
      {
        getActiveConfig: jest.fn(async () => ({
          version: 1,
          value: {
            enabled: true,
            observedStages: ['execution', 'response'],
            minConfidence: 0.6,
            maxBodyLength: 240,
            maxSummaryLength: 180,
            persistEmbeddings: true,
          },
        })),
      } as any,
      {
        getActiveResource: jest.fn(async () => ({
          version: 2,
          value: {
            enabledStages: ['execution', 'response'],
            metadataAllowList: ['toolName'],
            stagePolicies: {
              execution: {
                enabled: true,
                minConfidence: 0.7,
                defaultTags: ['approved'],
              },
            },
          },
        })),
      } as any,
      {
        storeCandidate: jest.fn(async () => ({
          id: 'knowledge-1',
          category: 'BOOKING',
          embeddingId: 'knowledge-1',
        })),
      } as any,
      {
        log: jest.fn(),
        error: jest.fn(),
      } as any,
    );

    service.enqueueLog({
      logId: 'log-1',
      tenantId: 'tenant-alpha',
      traceId: 'trace-1',
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        traceId: 'trace-1',
        stage: 'learning',
        status: 'completed',
        payload: expect.objectContaining({
          sourceLogId: 'log-1',
          knowledgeId: 'knowledge-1',
          category: 'BOOKING',
          knowledgeMetadataVersion: 2,
          learningConfigVersion: 1,
        }),
      }),
    );
  });

  it('skips observed logs when the governed policy disables extraction for that stage', async () => {
    const createLog = jest.fn(async (input: any) => ({
      id: 'learning-log-2',
      ...input,
    }));
    const service = new LearningService(
      {
        getTenantId: () => 'tenant-alpha',
        run: async (
          _context: { tenantId: string; traceId: string },
          callback: () => Promise<void>,
        ) => callback(),
      } as any,
      {
        findById: jest.fn(async () => ({
          id: 'log-2',
          conversationId: 'conv-2',
          traceId: 'trace-2',
          stage: 'response',
          status: 'completed',
          payload: {
            response: 'Hello',
          },
        })),
        createLog,
      } as any,
      {
        getActiveConfig: jest.fn(async () => ({
          version: 1,
          value: {
            enabled: true,
            observedStages: ['response'],
            minConfidence: 0.6,
            maxBodyLength: 240,
            maxSummaryLength: 180,
            persistEmbeddings: false,
          },
        })),
      } as any,
      {
        getActiveResource: jest.fn(async () => ({
          version: 3,
          value: {
            enabledStages: ['execution'],
            metadataAllowList: [],
            stagePolicies: {},
          },
        })),
      } as any,
      {
        storeCandidate: jest.fn(),
      } as any,
      {
        log: jest.fn(),
        error: jest.fn(),
      } as any,
    );

    service.enqueueLog({
      logId: 'log-2',
      tenantId: 'tenant-alpha',
      traceId: 'trace-2',
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'learning',
        status: 'skipped',
        payload: expect.objectContaining({
          sourceLogId: 'log-2',
          reason: 'stage_not_enabled',
        }),
      }),
    );
  });
});
