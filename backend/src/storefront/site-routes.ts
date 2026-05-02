export type SupportedLocale = "es" | "en";

export type SiteRouteKey = "home" | "shop" | "contact" | "about" | "faq" | "guides";

type RouteSchema = Record<SupportedLocale, Record<SiteRouteKey, string>>;

const DEFAULT_SITE_ROUTE_SCHEMA: RouteSchema = {
  es: {
    home: "/",
    shop: "/shop",
    contact: "/contacto",
    about: "/quienes-somos",
    faq: "/preguntas-frecuentes",
    guides: "/guias/cortinas-pvc-vs-aluminio",
  },
  en: {
    home: "/",
    shop: "/shop",
    contact: "/contact",
    about: "/about-us",
    faq: "/faq",
    guides: "/guides/cortinas-pvc-vs-aluminum",
  },
};

const loadSchemaOverrides = (): Partial<RouteSchema> | null => {
  const raw = process.env.SITE_ROUTE_SCHEMA_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<RouteSchema>;
  } catch {
    return null;
  }
};

const mergeSchema = (): RouteSchema => {
  const overrides = loadSchemaOverrides();
  return {
    es: { ...DEFAULT_SITE_ROUTE_SCHEMA.es, ...(overrides?.es ?? {}) },
    en: { ...DEFAULT_SITE_ROUTE_SCHEMA.en, ...(overrides?.en ?? {}) },
  };
};

const SITE_ROUTE_SCHEMA = mergeSchema();

export const resolveSiteRoute = (locale: SupportedLocale, key: SiteRouteKey): string => {
  return SITE_ROUTE_SCHEMA[locale]?.[key] ?? SITE_ROUTE_SCHEMA.es[key];
};

export const resolveDefaultSiteRoute = (key: SiteRouteKey): string => resolveSiteRoute("es", key);
