import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { PromptVersionRepository } from '../persistence/repositories/prompt-version.repository';
import { PromptTemplateProvider } from './prompt-template.provider';
import { PromptTemplateKey } from './prompt.types';

@Injectable()
export class PromptService {
  constructor(
    @Inject(PromptTemplateProvider)
    private readonly promptTemplateProvider: PromptTemplateProvider,
    private readonly promptVersionRepository: PromptVersionRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async getActivePrompt(key: PromptTemplateKey) {
    const prompt = await this.promptTemplateProvider.getActive(key);

    this.logger.debug(
      JSON.stringify({
        stage: 'prompt.retrieve',
        key,
        version: prompt?.version ?? null,
      }),
    );

    return prompt;
  }

  async listPrompts(key?: string) {
    await this.promptTemplateProvider.listActive();
    return this.promptVersionRepository.list(key);
  }

  async listActivePrompts() {
    const prompts = await this.promptTemplateProvider.listActive();

    return prompts.map((prompt) => ({
      id: prompt.id,
      key: prompt.key,
      template: prompt.value,
      version: prompt.version,
      status: prompt.status,
      metadata: prompt.metadata,
      createdAt: prompt.createdAt,
      createdBy: prompt.createdBy,
    }));
  }

  async createPromptVersion(input: {
    key: string;
    template: string;
    createdBy?: string;
    activate?: boolean;
  }) {
    const prompt = await this.promptVersionRepository.createVersion(input);

    this.logger.log(
      JSON.stringify({
        stage: 'prompt.versioned',
        key: prompt.key,
        version: prompt.version,
        status: prompt.status,
      }),
    );

    return prompt;
  }

  async activatePromptVersion(versionId: string, createdBy?: string) {
    const existing = await this.promptVersionRepository.findById(versionId);

    if (!existing) {
      throw new NotFoundException(`Prompt version ${versionId} was not found`);
    }

    if (existing.status === 'ACTIVE') {
      return existing;
    }

    const prompt = await this.promptVersionRepository.createVersion({
      key: existing.key,
      template: existing.template,
      metadata: {
        ...(existing.metadata as Record<string, unknown> | null | undefined),
        origin: 'admin',
        activatedFromVersionId: existing.id,
        activatedFromVersion: existing.version,
      } as Prisma.InputJsonValue,
      createdBy,
      activate: true,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'prompt.activated',
        key: prompt.key,
        version: prompt.version,
        sourceVersionId: existing.id,
        sourceVersion: existing.version,
      }),
    );

    return prompt;
  }
}
