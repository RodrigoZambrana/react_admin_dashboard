import type { StorefrontClientVariantConfig } from "../types";
import { DEFAULT_LOCALE } from "@/translations";
import { resolveLocalizedSiteRoute } from "@/lib/site-routes";

const config: StorefrontClientVariantConfig = {
  slug: "urucortinas",
  displayName: "UruCortinas",
  description: "Branding teal y foco en cortinas paramétricas.",
  configOverrides: {
    theme: {
      accentColor: "#0f766e",
      accentContrastColor: "#ecfeff",
      backgroundColor: "#f0fdfa",
      surfaceColor: "#ffffff",
      textColor: "#134e4a",
      mutedTextColor: "#0f766e",
      borderColor: "#99f6e4"
    },
    announcement: {
      id: "free-installation",
      message: "Instalación gratuita en Montevideo y Canelones todo el mes.",
      level: "success",
      active: true,
      cta: {
        id: "book-measurement",
        label: "Agendar medición",
        href: resolveLocalizedSiteRoute("contact", DEFAULT_LOCALE)
      }
    },
    seo: {
      siteName: "urucortinas",
      defaultTitle: "urucortinas",
      titleTemplate: "%s · urucortinas",
      defaultDescription: "Cortinas a medida con producción nacional y asesoramiento personalizado."
    },
    features: {
      languageSelector: false,
      supportedLocales: ["es"],
      defaultLocale: "es"
    }
  }
};

export default config;
