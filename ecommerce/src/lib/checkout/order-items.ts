import type { CartLineItem } from "@/state/cart-context";

export type CheckoutOrderItemInput = {
  productId: number;
  quantity: number;
  variantId?: number;
  configuration?: Record<string, unknown>;
};

export type CheckoutOrderItemsData = {
  items: CheckoutOrderItemInput[];
  error: string | null;
};

export const PARAMETRIC_LINE_MARKER = ":PARAM:";

export const isParametricCartLineId = (value: unknown): boolean =>
  typeof value === "string" && value.includes(PARAMETRIC_LINE_MARKER);

const PARAMETRIC_CONFIGURATION_KEYS = new Set([
  "derived",
  "width",
  "widthMm",
  "width_mm",
  "height",
  "heightMm",
  "height_mm",
  "reference",
  "sizeId",
  "series",
  "serie",
  "familyId",
  "family_id",
  "material",
  "color",
  "glass",
  "vidrio",
  "hasMosquitero",
  "hasShutterMonoblock",
  "monoblockEnabled",
  "mosquitoNet"
]);

export const hasMeaningfulParametricConfiguration = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Record<string, unknown>;
  return Object.entries(config).some(([key, rawValue]) => {
    if (!PARAMETRIC_CONFIGURATION_KEYS.has(key)) {
      return false;
    }
    if (key === "derived") {
      return rawValue === true;
    }
    return rawValue !== undefined && rawValue !== null && String(rawValue).trim().length > 0;
  });
};

export const extractProductIdFromCartLineId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const baseSegment = trimmed.includes(PARAMETRIC_LINE_MARKER)
    ? trimmed.split(PARAMETRIC_LINE_MARKER)[0]
    : trimmed;
  const parsed = Number(baseSegment);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeParametricConfiguration = (
  item: CartLineItem
): { config?: Record<string, unknown>; error?: string } => {
  const raw = item.product.configuration;
  if (!raw || typeof raw !== "object") {
    return {
      error: `Un artículo (“${item.product.name}”) necesita reconfiguración. Actualizá tu carrito y volvé a intentar.`
    };
  }

  const config = raw as Record<string, unknown>;

  const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const maybeWidth = coerceNumber(config.widthMm ?? config.width_mm ?? config.width);
  const maybeHeight = coerceNumber(config.heightMm ?? config.height_mm ?? config.height);
  const widthMm =
    maybeWidth !== undefined ? Math.round(maybeWidth > 10 ? maybeWidth : maybeWidth * 1000) : undefined;
  const heightMm =
    maybeHeight !== undefined ? Math.round(maybeHeight > 10 ? maybeHeight : maybeHeight * 1000) : undefined;

  const monoblock = (config.monoblock as Record<string, unknown> | undefined) ?? {};

  const normalized: Record<string, unknown> = {
    ...config,
    familyId: config.familyId ?? config.family_id ?? String(item.product.productId ?? item.product.id),
    serie: config.series ?? config.serie ?? config.seriesId ?? "DEFAULT",
    material: config.material ?? "ALUMINIO",
    color: config.color ?? "NATURAL",
    vidrio: config.glass ?? config.vidrio ?? "4 MM",
    widthMm,
    heightMm,
    hasMosquitero: config.mosquitoNet ?? config.hasMosquitero ?? false,
    hasShutterMonoblock:
      config.hasShutterMonoblock ??
      config.monoblockEnabled ??
      monoblock.enabled ??
      false,
    shutterMaterial: monoblock.material ?? config.shutterMaterial ?? undefined,
    shutterColor: monoblock.color ?? config.shutterColor ?? undefined,
    currency: config.currency,
    referenceDate: config.referenceDate,
    dataVersion: config.dataVersion,
    breakdown: config.breakdown
  };

  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === undefined) {
      delete normalized[key];
    }
  });

  return { config: normalized };
};

const normalizeDerivedConfiguration = (
  item: CartLineItem,
): { payload?: Pick<CheckoutOrderItemInput, "width" | "height" | "derived" | "reference">; error?: string } => {
  const raw = item.product.configuration;
  if (!raw || typeof raw !== "object") {
    return {
      error: `Un artículo (“${item.product.name}”) necesita reconfiguración. Actualizá tu carrito y volvé a intentar.`
    };
  }

  const config = raw as Record<string, unknown>;
  if (config.derived !== true) {
    return { payload: undefined };
  }

  const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const maybeWidth = coerceNumber(config.width ?? config.widthMm ?? config.width_mm);
  const maybeHeight = coerceNumber(config.height ?? config.heightMm ?? config.height_mm);
  const reference = coerceNumber(config.reference ?? config.sizeId);

  const width = maybeWidth !== undefined ? (maybeWidth > 10 ? maybeWidth / 1000 : maybeWidth) : undefined;
  const height = maybeHeight !== undefined ? (maybeHeight > 10 ? maybeHeight / 1000 : maybeHeight) : undefined;

  if (!width || !height || !reference) {
    return {
      error: `Un artículo (“${item.product.name}”) necesita reconfiguración. Actualizá tu carrito y volvé a intentar.`
    };
  }

  return {
    payload: {
      width,
      height,
      derived: true,
      reference,
    }
  };
};

export const buildCheckoutOrderItems = (items: CartLineItem[]): CheckoutOrderItemsData => {
  let configError: string | null = null;

  const normalizedItems = items
    .map((item) => {
      const productId =
        extractProductIdFromCartLineId(item.product.productId ?? null) ??
        extractProductIdFromCartLineId(item.product.id);
      if (!productId) {
        configError =
          configError ??
          `Un artículo (“${item.product.name}”) tiene una referencia inválida. Volvé a agregarlo al carrito antes de continuar.`;
        return null;
      }

      const rawVariantId = item.product.variantId;
      const variantId =
        typeof rawVariantId === "number" && Number.isFinite(rawVariantId)
          ? rawVariantId
          : undefined;

      const hasConfigObject = hasMeaningfulParametricConfiguration(item.product.configuration);
      const looksParametric = isParametricCartLineId(item.product.id);
      const requiresDynamicParametricConfiguration = Boolean(hasConfigObject || looksParametric);

      if (requiresDynamicParametricConfiguration) {
        const { payload: derivedPayload, error: derivedError } = normalizeDerivedConfiguration(item);
        if (derivedError) {
          configError = configError ?? derivedError;
          return null;
        }

        if (derivedPayload) {
          return {
            productId,
            quantity: Math.max(1, item.quantity),
            variantId,
            ...derivedPayload,
            configuration:
              item.product.configuration && typeof item.product.configuration === "object"
                ? (item.product.configuration as Record<string, unknown>)
                : undefined
          };
        }

        const { config, error } = normalizeParametricConfiguration(item);
        if (error) {
          configError = configError ?? error;
          return null;
        }

        return {
          productId,
          quantity: Math.max(1, item.quantity),
          variantId,
          configuration: config
        };
      }

      return {
        productId,
        quantity: Math.max(1, item.quantity),
        variantId,
        configuration:
          item.product.configuration && typeof item.product.configuration === "object"
            ? (item.product.configuration as Record<string, unknown>)
            : undefined
      };
    })
    .filter(Boolean) as CheckoutOrderItemInput[];

  return {
    items: normalizedItems,
    error: configError
  };
};
