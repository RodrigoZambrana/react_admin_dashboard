import { RuntimeManagedResourceVersion } from './runtime-managed-resource.types';

export abstract class RuntimeManagedResourceProvider<
  TKey extends string,
  TValue,
> {
  abstract getActive(
    key: TKey,
  ): Promise<RuntimeManagedResourceVersion<TKey, TValue> | null>;

  abstract listActive(): Promise<Array<RuntimeManagedResourceVersion<TKey, TValue>>>;
}
