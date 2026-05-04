import { env } from "@/lib/env";
import type { StorefrontConfig } from "@/types/storefront";

const normalizeBase = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.endsWith("/") ? trimmed : `${trimmed}/`).origin;
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin;
    } catch {
      return null;
    }
  }
};

export const resolveStorefrontOrigin = (config?: Pick<StorefrontConfig, "companyProfile"> | null): string => {
  const companyWebsite = config?.companyProfile?.website ?? null;
  return env.publicSiteOrigin ?? env.publicSiteUrl ?? normalizeBase(companyWebsite) ?? "http://localhost:3000";
};

export const resolveAbsoluteUrl = (path: string, config?: Pick<StorefrontConfig, "companyProfile"> | null): string => {
  const origin = resolveStorefrontOrigin(config);
  return new URL(path.startsWith("/") ? path : `/${path}`, origin).toString();
};
