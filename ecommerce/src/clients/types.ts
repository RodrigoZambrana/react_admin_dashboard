import type { StorefrontConfig } from "@/types/storefront";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

export interface StorefrontClientVariantConfig {
  slug: string;
  displayName: string;
  description?: string;
  configOverrides?: DeepPartial<StorefrontConfig>;
}
