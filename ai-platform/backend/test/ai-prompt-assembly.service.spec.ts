import { AiPromptAssemblyService } from '../src/modules/ai-gateway/ai-prompt-assembly.service';
import { AiPromptContractService } from '../src/modules/ai-gateway/ai-prompt-contract.service';
import { AiPromptPolicyService } from '../src/modules/ai-gateway/ai-prompt-policy.service';

describe('AiPromptAssemblyService', () => {
  it('builds interpretation requests from managed prompts and protocol instructions', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        id: 'prompt-1',
        version: 3,
        value: 'Classify the user request conservatively.',
      })),
    };

    const service = new AiPromptAssemblyService(
      new AiPromptPolicyService(promptService as any),
      new AiPromptContractService(),
    );
    const assembled = await service.buildInterpretationRequest({
      message: 'hola',
      locale: 'es',
    });

    expect(assembled.promptId).toBe('prompt-1');
    expect(assembled.promptVersion).toBe(3);
    expect(assembled.request.systemPrompt).toContain(
      'Classify the user request conservatively.',
    );
    expect(assembled.request.systemPrompt).toContain(
      'Governed editorial policy layer:',
    );
    expect(assembled.request.systemPrompt).toContain('Requested locale hint: es');
    expect(assembled.request.systemPrompt).toContain(
      'Backend-owned interpretation contract:',
    );
    expect(assembled.request.systemPrompt).toContain(
      '- Required keys: intent, entities, language, confidence.',
    );
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('interpretation');
  });

  it('skips managed prompt retrieval when a caller supplies the interpretation template', async () => {
    const promptService = {
      getActivePrompt: jest.fn(),
    };

    const service = new AiPromptAssemblyService(
      new AiPromptPolicyService(promptService as any),
      new AiPromptContractService(),
    );
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
        value: 'Rewrite the approved answer clearly.',
      })),
    };

    const service = new AiPromptAssemblyService(
      new AiPromptPolicyService(promptService as any),
      new AiPromptContractService(),
    );
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
    expect(assembled.request.systemPrompt).toContain(
      'Rewrite the approved answer clearly.',
    );
    expect(assembled.request.systemPrompt).toContain('Requested locale hint: es');
    expect(assembled.request.systemPrompt).toContain(
      'Backend-owned response contract:',
    );
    expect(assembled.request.systemPrompt).toContain(
      '  - assertedExecutionStatus: not_applicable | succeeded | failed',
    );
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('response');
  });

  it('falls back to backend-owned editorial defaults when no managed prompt is active', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => null),
    };
    const service = new AiPromptAssemblyService(
      new AiPromptPolicyService(promptService as any),
      new AiPromptContractService(),
    );

    const assembled = await service.buildResponseRequest({
      approvedContext: {
        locale: 'en',
        userMessage: 'hello',
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
          language: 'en',
          confidence: 0.9,
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
      approvedDraft: 'Hello there.',
    });

    expect(assembled.request.systemPrompt).toContain(
      'Rewrite the approved backend draft into a clear final user-facing answer.',
    );
    expect(assembled.request.systemPrompt).toContain(
      'Backend-owned response contract:',
    );
  });
});
