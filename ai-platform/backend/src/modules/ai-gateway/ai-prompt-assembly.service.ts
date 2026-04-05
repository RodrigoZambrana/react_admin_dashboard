import { Injectable } from '@nestjs/common';

import type {
  AssembledPromptView,
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
    const prompt = await this.describeInterpretationPrompt({
      locale: input.locale,
      promptTemplate: input.promptTemplate,
    });

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: prompt.assembledSystemPrompt,
        message: input.message,
        locale: input.locale,
        previousMessages: input.previousMessages ?? [],
      },
    };
  }

  async buildResponseRequest(
    input: ResponseGenerationInput,
  ): Promise<AssembledPromptRequest<LanguageModelResponseGenerationRequest>> {
    const prompt = await this.describeResponsePrompt({
      locale: input.approvedContext.locale,
      promptTemplate: input.promptTemplate,
    });

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: prompt.assembledSystemPrompt,
        approvedContext: input.approvedContext,
        approvedDraft: input.approvedDraft,
      },
    };
  }

  async describeInterpretationPrompt(input: {
    locale?: string;
    promptTemplate?: string;
  }): Promise<AssembledPromptView> {
    const policy = await this.promptPolicyService.resolveInterpretationPolicy(
      input.promptTemplate,
    );

    return this.buildPromptView('interpretation', policy, {
      locale: input.locale,
      safetyLines: this.promptContractService.buildInterpretationSafetyLines(),
      contractLines: this.promptContractService.buildInterpretationContractLines(),
    });
  }

  async describeResponsePrompt(input: {
    locale?: string;
    promptTemplate?: string;
  }): Promise<AssembledPromptView> {
    const policy = await this.promptPolicyService.resolveResponsePolicy(
      input.promptTemplate,
    );

    return this.buildPromptView('response', policy, {
      locale: input.locale,
      safetyLines: this.promptContractService.buildResponseSafetyLines(),
      contractLines: this.promptContractService.buildResponseContractLines(),
    });
  }

  private buildPromptView(
    key: 'interpretation' | 'response',
    policyLayer: Awaited<
      ReturnType<AiPromptPolicyService['resolveInterpretationPolicy']>
    >,
    input: {
      locale?: string;
      safetyLines: string[];
      contractLines: string[];
    },
  ): AssembledPromptView {
    return {
      key,
      promptId: policyLayer.promptId,
      promptVersion: policyLayer.promptVersion,
      source: policyLayer.source,
      localeHint: input.locale ?? null,
      effectivePolicy: policyLayer.value,
      recommendedPolicy: policyLayer.recommendedValue,
      differsFromRecommended: policyLayer.differsFromRecommended,
      managedPromptStatus: policyLayer.managedPromptStatus,
      managedPromptCreatedAt: policyLayer.managedPromptCreatedAt,
      managedPromptCreatedBy: policyLayer.managedPromptCreatedBy,
      safetyLines: input.safetyLines,
      contractLines: input.contractLines,
      assembledSystemPrompt: this.buildSystemPrompt({
        policyLayer: policyLayer.value,
        locale: input.locale,
        safetyLines: input.safetyLines,
        contractLines: input.contractLines,
      }),
    };
  }

  private buildSystemPrompt(input: {
    policyLayer: string;
    locale?: string;
    safetyLines: string[];
    contractLines: string[];
  }) {
    return [
      'Fixed safety layer:',
      ...input.safetyLines.map((line) => this.formatLayerLine(line)),
      '',
      'Governed editorial policy layer:',
      input.policyLayer.trim(),
      '',
      `Requested locale hint: ${input.locale ?? 'unknown'}`,
      '',
      'Backend-owned contract layer:',
      ...input.contractLines.map((line) => this.formatLayerLine(line)),
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

  private formatLayerLine(line: string) {
    return line.startsWith('  -') ? line : `- ${line}`;
  }
}
