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

export const buildCheckoutOrderItems = (items: CartLineItem[]): CheckoutOrderItemsData => {
  let configError: string | null = null;

  const normalizedItems = items
    .map((item) => {
      const productIdValue = item.product.productId ?? item.product.id;
      const productId = Number(productIdValue);
      if (!Number.isFinite(productId)) {
        return null;
      }

      const rawVariantId = item.product.variantId;
      const variantId =
        typeof rawVariantId === "number" && Number.isFinite(rawVariantId)
          ? rawVariantId
          : undefined;

      const hasConfigObject = item.product.configuration && typeof item.product.configuration === "object";
      const looksParametric = isParametricCartLineId(item.product.id);
      const requiresDynamicParametricConfiguration = Boolean(hasConfigObject || looksParametric);

      if (requiresDynamicParametricConfiguration) {
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
