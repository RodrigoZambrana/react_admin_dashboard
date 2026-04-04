import { Injectable } from '@nestjs/common';

import { PromptService } from '../prompt/prompt.service';
import {
  DEFAULT_INTERPRETATION_POLICY_PROMPT,
  DEFAULT_RESPONSE_POLICY_PROMPT,
} from './ai-prompt-policy.defaults';

type ResolvedPromptPolicy = {
  promptId: string | null;
  promptVersion: number | null;
  value: string;
};

@Injectable()
export class AiPromptPolicyService {
  constructor(private readonly promptService: PromptService) {}

  async resolveInterpretationPolicy(promptTemplate?: string) {
    return this.resolvePolicy(
      'interpretation',
      DEFAULT_INTERPRETATION_POLICY_PROMPT,
      promptTemplate,
    );
  }

  async resolveResponsePolicy(promptTemplate?: string) {
    return this.resolvePolicy(
      'response',
      DEFAULT_RESPONSE_POLICY_PROMPT,
      promptTemplate,
    );
  }

  private async resolvePolicy(
    key: 'interpretation' | 'response',
    fallback: string,
    promptTemplate?: string,
  ): Promise<ResolvedPromptPolicy> {
    if (promptTemplate !== undefined) {
      return {
        promptId: null,
        promptVersion: null,
        value: this.normalizePolicy(promptTemplate, fallback),
      };
    }

    const prompt = await this.promptService.getActivePrompt(key);

    return {
      promptId: prompt?.id ?? null,
      promptVersion: prompt?.version ?? null,
      value: this.normalizePolicy(prompt?.value, fallback),
    };
  }

  private normalizePolicy(value: string | null | undefined, fallback: string) {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : fallback;
  }
}
