import { Inject, Injectable } from '@nestjs/common';

import type { LanguageModelProvider } from '../ai-gateway.types';
import { LANGUAGE_MODEL_PROVIDERS } from './language-model-provider.tokens';

@Injectable()
export class LanguageModelProviderRegistry {
  private readonly providersByName: Map<string, LanguageModelProvider>;

  constructor(
    @Inject(LANGUAGE_MODEL_PROVIDERS)
    providers: LanguageModelProvider[],
  ) {
    this.providersByName = new Map(
      providers.map((provider) => [provider.providerName, provider]),
    );
  }

  resolve(providerName: string) {
    return this.providersByName.get(providerName) ?? null;
  }

  listProviderNames() {
    return Array.from(this.providersByName.keys());
  }
}
