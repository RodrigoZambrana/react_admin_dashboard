import { Injectable } from '@nestjs/common';

import type { AssembledPromptView } from './ai-gateway.types';
import { AiPromptAssemblyService } from './ai-prompt-assembly.service';

@Injectable()
export class AiPromptVisibilityService {
  constructor(
    private readonly promptAssemblyService: AiPromptAssemblyService,
  ) {}

  async listEffectivePromptViews(): Promise<AssembledPromptView[]> {
    return Promise.all([
      this.promptAssemblyService.describeInterpretationPrompt({
        locale: 'es',
      }),
      this.promptAssemblyService.describeResponsePrompt({
        locale: 'es',
      }),
    ]);
  }
}
