import { StorefrontApi } from "@/lib/api/storefront";

import { executeRecaptchaAction } from "@/utils/security/recaptcha";

let cachedSiteKey: string | null | undefined;

const resolveSiteKey = async (): Promise<string | null> => {
  if (cachedSiteKey !== undefined) {
    return cachedSiteKey;
  }

  try {
    const config = await StorefrontApi.getConfig();
    const recaptcha = config.integrations?.recaptcha;
    if (!recaptcha?.enabled || !recaptcha.siteKey) {
      cachedSiteKey = null;
      return null;
    }

    const trimmed = recaptcha.siteKey.trim();
    cachedSiteKey = trimmed.length > 0 ? trimmed : null;
    return cachedSiteKey;
  } catch {
    cachedSiteKey = null;
    return null;
  }
};

export const resolvePublicRecaptchaToken = async (action: string): Promise<string | undefined> => {
  const siteKey = await resolveSiteKey();
  if (!siteKey) {
    return undefined;
  }

  return executeRecaptchaAction(siteKey, action);
};
