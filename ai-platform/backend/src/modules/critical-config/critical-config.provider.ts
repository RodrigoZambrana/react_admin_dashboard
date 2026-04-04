import { RuntimeManagedResourceProvider } from '../runtime-resources/runtime-managed-resource.provider';
import { CriticalConfigKey, CriticalConfigValue } from './critical-config.types';

export abstract class CriticalConfigProvider extends RuntimeManagedResourceProvider<
  CriticalConfigKey,
  CriticalConfigValue
> {}
