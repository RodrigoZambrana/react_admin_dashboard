import type { StorefrontClientVariantConfig } from "../types";
import { buildDefaultPublicNavigation } from "@/lib/storefront/public-navigation";

const config: StorefrontClientVariantConfig = {
  slug: "retail",
  displayName: "Retail Demo",
  description: "Variante orientada a retail con acentos cálidos.",
  configOverrides: {
    theme: {
      accentColor: "#b45309",
      accentContrastColor: "#ffffff",
      backgroundColor: "#fff7ed",
      surfaceColor: "#ffffff",
      textColor: "#78350f",
      mutedTextColor: "#92400e",
      borderColor: "#fed7aa"
    },
    seo: {
      siteName: "Retail Boutique",
      defaultTitle: "Retail Boutique",
      titleTemplate: "%s · Retail Boutique",
      defaultDescription: "Descubrí la experiencia Retail Boutique con colecciones seleccionadas especialmente para tu negocio."
    },
    navigation: buildDefaultPublicNavigation()
  }
};

export default config;
