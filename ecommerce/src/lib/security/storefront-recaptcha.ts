import type { StorefrontConfig } from "@/types/storefront";

import { executeRecaptchaAction } from "@/utils/security/recaptcha";

export const getStorefrontRecaptchaSiteKey = (config: StorefrontConfig): string | null => {
  const recaptcha = config.integrations?.recaptcha;
  if (!recaptcha?.enabled || !recaptcha.siteKey) {
    return null;
  }

  const trimmed = recaptcha.siteKey.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveStorefrontRecaptchaToken = async (
  config: StorefrontConfig,
  action: string,
): Promise<string | undefined> => {
  const siteKey = getStorefrontRecaptchaSiteKey(config);
  if (!siteKey) {
    return undefined;
  }

  return executeRecaptchaAction(siteKey, action);
};
