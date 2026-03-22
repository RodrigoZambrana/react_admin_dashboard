import type { StorefrontClientVariantConfig } from "../types";
import { buildDefaultPublicNavigation } from "@/lib/storefront/public-navigation";

const config: StorefrontClientVariantConfig = {
  slug: "core",
  displayName: "Base Core",
  description: "Configuración compartida para las variantes del storefront.",
  configOverrides: {
    navigation: buildDefaultPublicNavigation()
  }
};

export default config;
