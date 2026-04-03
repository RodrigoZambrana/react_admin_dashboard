import { RuntimeManagedResourceProvider } from '../runtime-resources/runtime-managed-resource.provider';
import { PromptTemplateKey } from './prompt.types';

export abstract class PromptTemplateProvider extends RuntimeManagedResourceProvider<
  PromptTemplateKey,
  string
> {}
