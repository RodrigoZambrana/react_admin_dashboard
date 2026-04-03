import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { PromptVersionRepository } from '../persistence/repositories/prompt-version.repository';
import { defaultPromptTemplates } from './prompt.constants';

@Injectable()
export class PromptService {
  constructor(
    private readonly promptVersionRepository: PromptVersionRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async ensureDefaults() {
    for (const [key, template] of Object.entries(defaultPromptTemplates)) {
      const existing = await this.promptVersionRepository.getActiveByKey(key);

      if (!existing) {
        await this.promptVersionRepository.createVersion({
          key,
          template,
          activate: true,
          createdBy: 'system',
        });
      }
    }
  }

  async getActivePrompt(key: string) {
    await this.ensureDefaults();
    const prompt = await this.promptVersionRepository.getActiveByKey(key);

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
    await this.ensureDefaults();
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
