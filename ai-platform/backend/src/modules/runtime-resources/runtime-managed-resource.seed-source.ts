import { RuntimeManagedResourceSeed } from './runtime-managed-resource.types';

export abstract class RuntimeManagedResourceSeedSource<
  TKey extends string,
  TValue,
> {
  abstract getSeed(
    key: TKey,
  ): Promise<RuntimeManagedResourceSeed<TKey, TValue> | null>;

  abstract listSeeds(): Promise<Array<RuntimeManagedResourceSeed<TKey, TValue>>>;
}
