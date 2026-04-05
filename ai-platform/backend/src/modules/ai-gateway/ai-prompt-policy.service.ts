import { Injectable } from '@nestjs/common';
import type { ManagedResourceStatus } from '@prisma/client';

import { PromptService } from '../prompt/prompt.service';
import type { PromptPolicySource } from './ai-gateway.types';

type ResolvedPromptPolicy = {
  promptId: string | null;
  promptVersion: number | null;
  value: string;
  source: PromptPolicySource;
  recommendedValue: string;
  differsFromRecommended: boolean;
  managedPromptStatus: ManagedResourceStatus | null;
  managedPromptCreatedAt: string | null;
  managedPromptCreatedBy: string | null;
};

@Injectable()
export class AiPromptPolicyService {
  constructor(private readonly promptService: PromptService) {}

  async resolveInterpretationPolicy(promptTemplate?: string) {
    return this.resolvePolicy('interpretation', promptTemplate);
  }

  async resolveResponsePolicy(promptTemplate?: string) {
    return this.resolvePolicy('response', promptTemplate);
  }

  private async resolvePolicy(
    key: 'interpretation' | 'response',
    promptTemplate?: string,
  ): Promise<ResolvedPromptPolicy> {
    const recommendedPrompt = await this.promptService.getRecommendedPrompt(key);
    const recommendedValue = this.normalizePolicy(recommendedPrompt?.value);

    if (promptTemplate !== undefined) {
      const value = this.normalizePolicy(promptTemplate, recommendedValue);

      return {
        promptId: null,
        promptVersion: null,
        value,
        source: 'caller_override',
        recommendedValue,
        differsFromRecommended: value !== recommendedValue,
        managedPromptStatus: null,
        managedPromptCreatedAt: null,
        managedPromptCreatedBy: null,
      };
    }

    const prompt = await this.promptService.getActivePrompt(key);
    const value = this.normalizePolicy(prompt?.value, recommendedValue);

    return {
      promptId: prompt?.id ?? null,
      promptVersion: prompt?.version ?? null,
      value,
      source: prompt ? 'managed' : 'recommended_default',
      recommendedValue,
      differsFromRecommended: value !== recommendedValue,
      managedPromptStatus: (prompt?.status as ManagedResourceStatus | null) ?? null,
      managedPromptCreatedAt: prompt?.createdAt?.toISOString() ?? null,
      managedPromptCreatedBy: prompt?.createdBy ?? null,
    };
  }

  private normalizePolicy(value: string | null | undefined, fallback = '') {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : fallback.trim();
  }
}
