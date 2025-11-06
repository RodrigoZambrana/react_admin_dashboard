import { DEFAULT_CLIENT_SLUG } from "@/constants/tenancy";

import core from "./core/config";
import retail from "./retail/config";
import urucortinas from "./urucortinas/config";
import type { StorefrontClientVariantConfig } from "./types";

const variants: StorefrontClientVariantConfig[] = [core, retail, urucortinas];

const registry = new Map<string, StorefrontClientVariantConfig>(
  variants.map((variant) => [variant.slug, variant])
);

const normalizeSlug = (slug?: string | null) => {
  if (!slug) {
    return DEFAULT_CLIENT_SLUG;
  }
  const trimmed = slug.trim().toLowerCase();
  return trimmed || DEFAULT_CLIENT_SLUG;
};

export const getClientVariantConfig = (slug?: string | null): StorefrontClientVariantConfig => {
  const normalized = normalizeSlug(slug);
  return registry.get(normalized) ?? registry.get(DEFAULT_CLIENT_SLUG)!;
};

export const listClientVariants = (): StorefrontClientVariantConfig[] => [...variants];

export type { StorefrontClientVariantConfig } from "./types";
