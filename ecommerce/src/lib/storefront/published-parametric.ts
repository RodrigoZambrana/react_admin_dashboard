import type { PublishedParametricVariant } from "@/types/storefront";
import { PARAMETRIC_LINE_MARKER } from "@/lib/checkout/order-items";

export type PublishedParametricSelection = {
  serie: string;
  material: string;
  color: string;
  vidrio: string;
  widthMm?: number;
  heightMm?: number;
  hasMosquitero: boolean;
  hasShutterMonoblock: boolean;
  shutterMaterial: string;
};

type SelectionField = keyof PublishedParametricSelection;

const BASE_FIELDS: Array<SelectionField> = ["serie", "material", "color", "vidrio", "widthMm", "heightMm"];

export const toPublishedParametricSelection = (
  variant?: PublishedParametricVariant | null
): PublishedParametricSelection => ({
  serie: variant?.optionValues.serie ?? "",
  material: variant?.optionValues.material ?? "",
  color: variant?.optionValues.color ?? "",
  vidrio: variant?.optionValues.vidrio ?? "",
  widthMm: variant?.optionValues.widthMm,
  heightMm: variant?.optionValues.heightMm,
  hasMosquitero: variant?.optionValues.hasMosquitero ?? false,
  hasShutterMonoblock: variant?.optionValues.hasShutterMonoblock ?? false,
  shutterMaterial: variant?.optionValues.shutterMaterial ?? ""
});

export const matchesPublishedParametricVariant = (
  variant: PublishedParametricVariant,
  selection: PublishedParametricSelection
) =>
  variant.optionValues.serie === selection.serie &&
  variant.optionValues.material === selection.material &&
  variant.optionValues.color === selection.color &&
  variant.optionValues.vidrio === selection.vidrio &&
  variant.optionValues.widthMm === selection.widthMm &&
  variant.optionValues.heightMm === selection.heightMm &&
  variant.optionValues.hasMosquitero === selection.hasMosquitero &&
  variant.optionValues.hasShutterMonoblock === selection.hasShutterMonoblock &&
  variant.optionValues.shutterMaterial === selection.shutterMaterial;

const isCompatibleWithSelection = (
  variant: PublishedParametricVariant,
  selection: PublishedParametricSelection,
  ignoredFields: SelectionField[] = []
) => {
  const ignored = new Set<SelectionField>(ignoredFields);

  for (const field of BASE_FIELDS) {
    if (ignored.has(field)) continue;
    if (variant.optionValues[field] !== selection[field]) {
      return false;
    }
  }

  if (!ignored.has("hasMosquitero") && variant.optionValues.hasMosquitero !== selection.hasMosquitero) {
    return false;
  }

  if (!ignored.has("widthMm") && selection.widthMm !== undefined && variant.optionValues.widthMm !== selection.widthMm) {
    return false;
  }

  if (!ignored.has("heightMm") && selection.heightMm !== undefined && variant.optionValues.heightMm !== selection.heightMm) {
    return false;
  }

  if (
    !ignored.has("hasShutterMonoblock") &&
    variant.optionValues.hasShutterMonoblock !== selection.hasShutterMonoblock
  ) {
    return false;
  }

  if (
    !ignored.has("shutterMaterial") &&
    selection.hasShutterMonoblock &&
    variant.optionValues.hasShutterMonoblock &&
    variant.optionValues.shutterMaterial !== selection.shutterMaterial
  ) {
    return false;
  }

  return true;
};

export const findCompatiblePublishedParametricVariant = (
  variants: PublishedParametricVariant[],
  selection: PublishedParametricSelection,
  ignoredFields: SelectionField[] = []
) => variants.find((variant) => isCompatibleWithSelection(variant, selection, ignoredFields)) ?? null;

export const isPublishedParametricOptionSelectable = (
  variants: PublishedParametricVariant[],
  selection: PublishedParametricSelection,
  field: SelectionField,
  value: string | boolean
) => {
  return Boolean(findPreferredPublishedParametricVariant(variants, selection, field, value));
};

export const findPreferredPublishedParametricVariant = (
  variants: PublishedParametricVariant[],
  selection: PublishedParametricSelection,
  field: SelectionField,
  value: string | boolean
) => {
  const candidates = variants.filter((variant) => {
    for (const baseField of BASE_FIELDS) {
      if (variant.optionValues[baseField] !== selection[baseField]) {
        return false;
      }
    }

    const optionValue = variant.optionValues[field];
    if (optionValue !== value) {
      return false;
    }

    if (field === "shutterMaterial" && !variant.optionValues.hasShutterMonoblock) {
      return false;
    }

    return true;
  });

  const ranked = [...candidates].sort((left, right) => {
    const score = (candidate: PublishedParametricVariant) => {
      let result = 0;

      if (candidate.optionValues.hasMosquitero === selection.hasMosquitero) {
        result += 6;
      }

      if (candidate.optionValues.hasShutterMonoblock === selection.hasShutterMonoblock) {
        result += 6;
      }

      if (
        selection.hasShutterMonoblock &&
        candidate.optionValues.hasShutterMonoblock &&
        candidate.optionValues.shutterMaterial === selection.shutterMaterial
      ) {
        result += 4;
      }

      if (
        field === "hasMosquitero" &&
        selection.hasShutterMonoblock &&
        candidate.optionValues.hasShutterMonoblock &&
        candidate.optionValues.shutterMaterial !== selection.shutterMaterial
      ) {
        result -= 8;
      }

      if (
        field === "hasShutterMonoblock" &&
        candidate.optionValues.hasMosquitero === selection.hasMosquitero
      ) {
        result += 3;
      }

      return result;
    };

    return score(right) - score(left);
  });

  return ranked[0] ?? null;
};

export const resolvePublishedParametricSelection = (
  variants: PublishedParametricVariant[],
  requestedSelection: PublishedParametricSelection,
  fallbackSelection?: PublishedParametricSelection
) => {
  const exact = variants.find((variant) => matchesPublishedParametricVariant(variant, requestedSelection));
  if (exact) {
    return toPublishedParametricSelection(exact);
  }

  const withDependentFallback =
    findCompatiblePublishedParametricVariant(
      variants,
      requestedSelection,
      requestedSelection.hasShutterMonoblock ? [] : ["shutterMaterial"]
    ) ??
    findCompatiblePublishedParametricVariant(variants, requestedSelection, ["shutterMaterial"]) ??
    findCompatiblePublishedParametricVariant(variants, requestedSelection, [
      "hasShutterMonoblock",
      "shutterMaterial"
    ]);

  if (withDependentFallback) {
    return toPublishedParametricSelection(withDependentFallback);
  }

  return fallbackSelection ?? requestedSelection;
};

const coerceString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "si", "sí", "y"].includes(normalized);
  }
  return false;
};

type TranslateFn = (key: string, options?: { defaultMessage?: string; values?: Record<string, unknown> }) => string;

export const buildPublishedParametricSummaryEntries = (
  selection: PublishedParametricSelection | Record<string, unknown> | null | undefined,
  t: TranslateFn,
  options?: { includeMaterial?: boolean }
) => {
  if (!selection) {
    return [] as Array<{ attribute: string; value: string }>;
  }

  const normalized: PublishedParametricSelection = {
    serie: coerceString((selection as Record<string, unknown>).serie),
    material: coerceString((selection as Record<string, unknown>).material),
    color: coerceString((selection as Record<string, unknown>).color),
    vidrio: coerceString((selection as Record<string, unknown>).vidrio ?? (selection as Record<string, unknown>).glass),
    widthMm:
      typeof (selection as Record<string, unknown>).widthMm === "number"
        ? Number((selection as Record<string, unknown>).widthMm)
        : typeof (selection as Record<string, unknown>).widthMm === "string" &&
            Number.isFinite(Number((selection as Record<string, unknown>).widthMm))
          ? Number((selection as Record<string, unknown>).widthMm)
          : undefined,
    heightMm:
      typeof (selection as Record<string, unknown>).heightMm === "number"
        ? Number((selection as Record<string, unknown>).heightMm)
        : typeof (selection as Record<string, unknown>).heightMm === "string" &&
            Number.isFinite(Number((selection as Record<string, unknown>).heightMm))
          ? Number((selection as Record<string, unknown>).heightMm)
          : undefined,
    hasMosquitero: coerceBoolean(
      (selection as Record<string, unknown>).hasMosquitero ?? (selection as Record<string, unknown>).mosquitoNet
    ),
    hasShutterMonoblock: coerceBoolean(
      (selection as Record<string, unknown>).hasShutterMonoblock ??
        (selection as Record<string, unknown>).monoblockEnabled
    ),
    shutterMaterial: coerceString(
      (selection as Record<string, unknown>).shutterMaterial ??
        (selection as Record<string, unknown>).shutterSystem ??
        (selection as Record<string, unknown>).monoblockMaterial
    )
  };

  const entries = [
    {
      attribute: t("product.parametric.fields.series", { defaultMessage: "Series" }),
      value: normalized.serie
    },
    options?.includeMaterial
      ? {
          attribute: t("product.parametric.fields.material", { defaultMessage: "Material" }),
          value: normalized.material
        }
      : null,
    {
      attribute: t("product.parametric.fields.color", { defaultMessage: "Color" }),
      value: normalized.color
    },
    {
      attribute: t("product.parametric.fields.glass", { defaultMessage: "Glass" }),
      value: normalized.vidrio
    },
    {
      attribute: t("product.parametric.fields.mosquito", { defaultMessage: "Mosquito net" }),
      value: normalized.hasMosquitero
        ? t("product.parametric.options.withMosquito", { defaultMessage: "With mosquito net" })
        : t("product.parametric.options.withoutMosquito", { defaultMessage: "Without mosquito net" })
    },
    {
      attribute: t("product.parametric.fields.monoblock", { defaultMessage: "Monoblock" }),
      value: normalized.hasShutterMonoblock
        ? t("product.parametric.options.withShutterMaterial", {
            defaultMessage: "With shutter ({material})",
            values: {
              material:
                normalized.shutterMaterial ||
                t("product.parametric.options.genericShutter", { defaultMessage: "Generic" })
            }
          })
        : t("product.parametric.options.withoutShutter", { defaultMessage: "Without shutter" })
    }
  ].filter(Boolean) as Array<{ attribute: string; value: string }>;

  return entries.filter((entry) => entry.value);
};

export const buildPublishedParametricDetailHref = (
  slug: string,
  configuration?: Record<string, unknown> | null,
  productId?: string | number | null,
) => {
  const params = new URLSearchParams();
  if (productId !== null && productId !== undefined && String(productId).trim().length > 0) {
    params.set("id", String(productId).trim());
  }
  if (configuration) {
    const mappings: Array<[string, unknown]> = [
      ["serie", configuration.serie],
      ["color", configuration.color],
      ["vidrio", configuration.vidrio ?? configuration.glass],
      ["widthMm", configuration.widthMm],
      ["heightMm", configuration.heightMm],
      ["hasMosquitero", configuration.hasMosquitero ?? configuration.mosquitoNet],
      ["hasShutterMonoblock", configuration.hasShutterMonoblock ?? configuration.monoblockEnabled],
      ["shutterMaterial", configuration.shutterMaterial ?? configuration.shutterSystem]
    ];

    mappings.forEach(([key, value]) => {
      if (typeof value === "boolean") {
        params.set(key, value ? "1" : "0");
      } else if (typeof value === "number" && Number.isFinite(value)) {
        params.set(key, String(value));
      } else if (typeof value === "string" && value.trim().length > 0) {
        params.set(key, value.trim());
      }
    });
  }

  const query = params.toString();
  return query ? `/product/${slug}?${query}` : `/product/${slug}`;
};

export const buildPublishedParametricLineId = (
  productId: string | number,
  variantKey: string
) => `${String(productId)}${PARAMETRIC_LINE_MARKER}${variantKey}`;

export const selectionFromSearchParams = (
  searchParams: URLSearchParams,
  defaultSelection: PublishedParametricSelection
): PublishedParametricSelection => {
  const nextSelection: PublishedParametricSelection = {
    ...defaultSelection,
    serie: searchParams.get("serie")?.trim() || defaultSelection.serie,
    color: searchParams.get("color")?.trim() || defaultSelection.color,
    vidrio: searchParams.get("vidrio")?.trim() || defaultSelection.vidrio,
    widthMm: searchParams.has("widthMm")
      ? Number(searchParams.get("widthMm"))
      : defaultSelection.widthMm,
    heightMm: searchParams.has("heightMm")
      ? Number(searchParams.get("heightMm"))
      : defaultSelection.heightMm,
    hasMosquitero: searchParams.has("hasMosquitero")
      ? coerceBoolean(searchParams.get("hasMosquitero"))
      : defaultSelection.hasMosquitero,
    hasShutterMonoblock: searchParams.has("hasShutterMonoblock")
      ? coerceBoolean(searchParams.get("hasShutterMonoblock"))
      : defaultSelection.hasShutterMonoblock,
    shutterMaterial: searchParams.get("shutterMaterial")?.trim() || defaultSelection.shutterMaterial
  };

  if (!nextSelection.hasShutterMonoblock) {
    nextSelection.shutterMaterial = "";
  }

  return nextSelection;
};
