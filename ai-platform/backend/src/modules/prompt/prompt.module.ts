import { Module } from '@nestjs/common';

import { FileSystemPromptTemplateSeedSource } from './filesystem-prompt-template.seed-source';
import { ManagedPromptTemplateProvider } from './managed-prompt-template.provider';
import { PromptTemplateProvider } from './prompt-template.provider';
import { PromptService } from './prompt.service';

@Module({
  providers: [
    FileSystemPromptTemplateSeedSource,
    ManagedPromptTemplateProvider,
    {
      provide: PromptTemplateProvider,
      useExisting: ManagedPromptTemplateProvider,
    },
    PromptService,
  ],
  exports: [PromptTemplateProvider, PromptService],
})
export class PromptModule {}
