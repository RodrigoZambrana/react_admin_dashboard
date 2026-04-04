import { Injectable } from '@nestjs/common';

import { PromptService } from '../prompt/prompt.service';
import type {
  AssembledPromptRequest,
  InterpretationInput,
  LanguageModelInterpretationRequest,
  LanguageModelResponseGenerationRequest,
  ResponseGenerationInput,
} from './ai-gateway.types';

const INTERPRETATION_PROTOCOL_LINES = [
  'Return JSON only.',
];

const RESPONSE_PROTOCOL_LINES = [
  'You will receive:',
  '- approved backend context as JSON',
  '- an approved deterministic fallback draft',
  '',
  'Rewrite the approved draft into a clear final user-facing answer.',
  'Do not invent tool executions, business facts, missing fields, or continuity state.',
  'Do not hide failures or uncertainty.',
  'Keep the meaning grounded in approved backend context only.',
  '',
  'Return JSON only with:',
  '- message: string',
  '- assertedOutcome: respond | clarify | execution_succeeded | execution_failed',
  '- assertedExecutionStatus: not_applicable | succeeded | failed',
  '- mentionedMissingFields: string[]',
  '- mentionedApprovedFactKeys: string[]',
  '- mentionedApprovedResultKeys: string[]',
];

type ResolvedPromptTemplate = {
  promptId: string | null;
  promptVersion: number | null;
  value: string;
};

@Injectable()
export class AiPromptAssemblyService {
  constructor(private readonly promptService: PromptService) {}

  async buildInterpretationRequest(
    input: InterpretationInput,
  ): Promise<AssembledPromptRequest<LanguageModelInterpretationRequest>> {
    const prompt = await this.resolvePrompt('interpretation', input.promptTemplate);

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: this.buildSystemPrompt(prompt.value, {
          locale: input.locale,
          protocolLines: INTERPRETATION_PROTOCOL_LINES,
        }),
        message: input.message,
        locale: input.locale,
        previousMessages: input.previousMessages ?? [],
      },
    };
  }

  async buildResponseRequest(
    input: ResponseGenerationInput,
  ): Promise<AssembledPromptRequest<LanguageModelResponseGenerationRequest>> {
    const prompt = await this.resolvePrompt('response', input.promptTemplate);

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: this.buildSystemPrompt(prompt.value, {
          locale: input.approvedContext.locale,
          protocolLines: RESPONSE_PROTOCOL_LINES,
        }),
        approvedContext: input.approvedContext,
        approvedDraft: input.approvedDraft,
      },
    };
  }

  private async resolvePrompt(
    key: 'interpretation' | 'response',
    promptTemplate?: string,
  ): Promise<ResolvedPromptTemplate> {
    if (promptTemplate !== undefined) {
      return {
        promptId: null,
        promptVersion: null,
        value: promptTemplate,
      };
    }

    const prompt = await this.promptService.getActivePrompt(key);

    return {
      promptId: prompt?.id ?? null,
      promptVersion: prompt?.version ?? null,
      value: prompt?.value ?? '',
    };
  }

  private buildSystemPrompt(
    template: string,
    input: {
      locale?: string;
      protocolLines: string[];
    },
  ) {
    return [
      template.trim(),
      '',
      `Requested locale hint: ${input.locale ?? 'unknown'}`,
      ...input.protocolLines,
    ]
      .filter((line, index, lines) => {
        if (line.length > 0) {
          return true;
        }

        return lines[index - 1] !== '';
      })
      .join('\n')
      .trim();
  }
}
