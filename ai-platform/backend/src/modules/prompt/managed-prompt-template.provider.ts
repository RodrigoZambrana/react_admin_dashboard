import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PromptVersionRepository } from '../persistence/repositories/prompt-version.repository';
import { RuntimeManagedResourceVersion } from '../runtime-resources/runtime-managed-resource.types';
import { FileSystemPromptTemplateSeedSource } from './filesystem-prompt-template.seed-source';
import { PromptTemplateProvider } from './prompt-template.provider';
import { PromptTemplateKey } from './prompt.types';

@Injectable()
export class ManagedPromptTemplateProvider extends PromptTemplateProvider {
  constructor(
    private readonly promptVersionRepository: PromptVersionRepository,
    private readonly seedSource: FileSystemPromptTemplateSeedSource,
  ) {
    super();
  }

  async getActive(
    key: PromptTemplateKey,
  ): Promise<RuntimeManagedResourceVersion<PromptTemplateKey, string> | null> {
    await this.ensureBootstrapSeeded();
    const prompt = await this.promptVersionRepository.getActiveByKey(key);

    return prompt ? this.mapRecord(prompt) : null;
  }

  async listActive(): Promise<
    Array<RuntimeManagedResourceVersion<PromptTemplateKey, string>>
  > {
    await this.ensureBootstrapSeeded();
    const prompts = await this.promptVersionRepository.listActive();

    return prompts.map((prompt) => this.mapRecord(prompt));
  }

  private async ensureBootstrapSeeded() {
    const hasAnyVersions = await this.promptVersionRepository.hasAnyVersions();

    if (hasAnyVersions) {
      return;
    }

    const seeds = await this.seedSource.listSeeds();

    for (const seed of seeds) {
      await this.promptVersionRepository.createVersion({
        key: seed.key,
        template: seed.value,
        metadata: seed.metadata as Prisma.InputJsonValue,
        createdBy: seed.createdBy,
        activate: true,
      });
    }
  }

  private mapRecord(record: {
    id: string;
    key: string;
    template: string;
    version: number;
    status: string;
    metadata: unknown;
    createdAt: Date;
    createdBy: string | null;
  }): RuntimeManagedResourceVersion<PromptTemplateKey, string> {
    return {
      id: record.id,
      key: record.key as PromptTemplateKey,
      value: record.template,
      version: record.version,
      status: record.status as RuntimeManagedResourceVersion<
        PromptTemplateKey,
        string
      >['status'],
      metadata: record.metadata as RuntimeManagedResourceVersion<
        PromptTemplateKey,
        string
      >['metadata'],
      createdAt: record.createdAt,
      createdBy: record.createdBy,
    };
  }
}
