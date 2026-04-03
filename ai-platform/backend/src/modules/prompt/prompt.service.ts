import { Inject, Injectable } from '@nestjs/common';

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

  async listPrompts() {
    await this.promptTemplateProvider.listActive();
    return this.promptVersionRepository.list();
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
}
