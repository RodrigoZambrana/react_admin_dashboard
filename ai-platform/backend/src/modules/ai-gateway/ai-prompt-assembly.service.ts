import { Injectable } from '@nestjs/common';

import type {
  AssembledPromptRequest,
  InterpretationInput,
  LanguageModelInterpretationRequest,
  LanguageModelResponseGenerationRequest,
  ResponseGenerationInput,
} from './ai-gateway.types';
import { AiPromptContractService } from './ai-prompt-contract.service';
import { AiPromptPolicyService } from './ai-prompt-policy.service';

@Injectable()
export class AiPromptAssemblyService {
  constructor(
    private readonly promptPolicyService: AiPromptPolicyService,
    private readonly promptContractService: AiPromptContractService,
  ) {}

  async buildInterpretationRequest(
    input: InterpretationInput,
  ): Promise<AssembledPromptRequest<LanguageModelInterpretationRequest>> {
    const prompt = await this.promptPolicyService.resolveInterpretationPolicy(
      input.promptTemplate,
    );

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: this.buildSystemPrompt(prompt.value, {
          locale: input.locale,
          contractLines: this.promptContractService.buildInterpretationContract(),
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
    const prompt = await this.promptPolicyService.resolveResponsePolicy(
      input.promptTemplate,
    );

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: this.buildSystemPrompt(prompt.value, {
          locale: input.approvedContext.locale,
          contractLines: this.promptContractService.buildResponseContract(),
        }),
        approvedContext: input.approvedContext,
        approvedDraft: input.approvedDraft,
      },
    };
  }

  private buildSystemPrompt(
    policyLayer: string,
    input: {
      locale?: string;
      contractLines: string[];
    },
  ) {
    return [
      'Governed editorial policy layer:',
      policyLayer.trim(),
      '',
      `Requested locale hint: ${input.locale ?? 'unknown'}`,
      '',
      ...input.contractLines,
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
