import { AiPromptAssemblyService } from '../src/modules/ai-gateway/ai-prompt-assembly.service';

describe('AiPromptAssemblyService', () => {
  it('builds interpretation requests from managed prompts and protocol instructions', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        id: 'prompt-1',
        version: 3,
        value: 'Classify the user request.',
      })),
    };

    const service = new AiPromptAssemblyService(promptService as any);
    const assembled = await service.buildInterpretationRequest({
      message: 'hola',
      locale: 'es',
    });

    expect(assembled.promptId).toBe('prompt-1');
    expect(assembled.promptVersion).toBe(3);
    expect(assembled.request.systemPrompt).toContain('Classify the user request.');
    expect(assembled.request.systemPrompt).toContain('Requested locale hint: es');
    expect(assembled.request.systemPrompt).toContain('Return JSON only.');
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('interpretation');
  });

  it('skips managed prompt retrieval when a caller supplies the interpretation template', async () => {
    const promptService = {
      getActivePrompt: jest.fn(),
    };

    const service = new AiPromptAssemblyService(promptService as any);
    const assembled = await service.buildInterpretationRequest({
      message: 'hola',
      locale: 'es',
      promptTemplate: 'Caller interpretation prompt.',
    });

    expect(assembled.promptId).toBeNull();
    expect(assembled.promptVersion).toBeNull();
    expect(assembled.request.systemPrompt).toContain('Caller interpretation prompt.');
    expect(promptService.getActivePrompt).not.toHaveBeenCalled();
  });

  it('builds response requests from managed prompts and approved-context protocol instructions', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        id: 'prompt-2',
        version: 7,
        value: 'Rewrite the approved answer.',
      })),
    };

    const service = new AiPromptAssemblyService(promptService as any);
    const assembled = await service.buildResponseRequest({
      approvedContext: {
        locale: 'es',
        userMessage: 'hola',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
      },
      approvedDraft: 'Hola, como puedo ayudarte?',
    });

    expect(assembled.promptId).toBe('prompt-2');
    expect(assembled.promptVersion).toBe(7);
    expect(assembled.request.systemPrompt).toContain('Rewrite the approved answer.');
    expect(assembled.request.systemPrompt).toContain('Requested locale hint: es');
    expect(assembled.request.systemPrompt).toContain(
      'Do not invent tool executions, business facts, missing fields, or continuity state.',
    );
    expect(assembled.request.systemPrompt).toContain(
      '- assertedExecutionStatus: not_applicable | succeeded | failed',
    );
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('response');
  });
});
