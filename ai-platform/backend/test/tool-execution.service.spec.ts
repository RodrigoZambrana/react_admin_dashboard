import { ToolExecutionService } from '../src/modules/tools/tool-execution.service';

describe('ToolExecutionService', () => {
  it('injects tenant and trace context automatically into approved tool execution', async () => {
    const toolEngine = {
      execute: jest.fn(async () => ({
        ok: true,
        toolName: 'get_product',
        validatedInput: {
          query: 'lamp',
        },
        payload: {
          sku: 'B-77',
        },
        durationMs: 2,
      })),
    };
    const service = new ToolExecutionService(
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-tool-execution',
      } as any,
      toolEngine as any,
    );
    const interpretation: any = {
      intent: 'GET_PRODUCT',
      entities: {
        rawMessage: 'lamp',
      },
      language: 'en',
      confidence: 0.82,
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
    };

    await service.executeApprovedAction({
      decision: {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'get_product',
        reasonCode: 'product_lookup_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.ecommerce.product_result',
      },
      interpretation,
    });

    expect(toolEngine.execute).toHaveBeenCalledWith('get_product', {
      interpretation,
      tenantId: 'tenant-alpha',
      traceId: 'trace-tool-execution',
    });
  });

  it('does not execute tools for non-invoke decisions', async () => {
    const toolEngine = {
      execute: jest.fn(),
    };
    const service = new ToolExecutionService(
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-tool-execution',
      } as any,
      toolEngine as any,
    );

    await expect(
      service.executeApprovedAction({
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          intent: 'GENERAL_CONVERSATION',
          entities: {},
          language: 'en',
          confidence: 0.9,
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
      }),
    ).resolves.toBeNull();
    expect(toolEngine.execute).not.toHaveBeenCalled();
  });
});
