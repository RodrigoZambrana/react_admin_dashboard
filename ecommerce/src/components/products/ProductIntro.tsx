"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { IconMinus, IconPlus } from "@tabler/icons-react";

import Box from "@component/Box";
import Image from "@component/Image";
import Rating from "@component/rating";
import Avatar from "@component/avatar";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { H1, H2, H3, H6, Paragraph, SemiSpan } from "@component/Typography";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import TrackedButton from "@component/TrackedButton";
import ProductWishlistButton from "@component/product-cards/ProductWishlistButton";

import useCart from "@hook/useCart";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";
import {
  buildPublishedParametricLineId,
  buildPublishedParametricSummaryEntries,
  findPreferredPublishedParametricVariant,
  isPublishedParametricOptionSelectable,
  matchesPublishedParametricVariant,
  resolvePublishedParametricSelection,
  selectionFromSearchParams,
  toPublishedParametricSelection,
  type PublishedParametricSelection
} from "@/lib/storefront/published-parametric";
import { formatInventoryStatus, normalizeMoney } from "@/lib/utils/format";
import { filterValidProductImages } from "@/lib/utils/image";
import { useTranslation } from "@/state/i18n-context";
import type {
  InventoryStatus,
  CanonicalConfiguration,
  PublishedParametricOptions,
  ProductAttributeDefinition,
  ProductAttributeType,
  ProductMode,
  ProductVariantAttribute
} from "@/types/storefront";

const ATTRIBUTE_ORDER: ProductAttributeType[] = ["COLOR", "SIZE", "MATERIAL"];

type SelectedAttributeMap = Partial<Record<ProductAttributeType, string>>;

type VariantSummary = NonNullable<Props["variants"]>[number];
type PublishedParametricVariantSummary = NonNullable<Props["publishedParametricOptions"]>["variants"][number];

const buildLineId = (productId: string | number, variantId?: number) =>
  variantId !== undefined && variantId !== null ? `${String(productId)}:${variantId}` : String(productId);

const buildDerivedLineId = (productId: string | number, sizeId: number) =>
  `${String(productId)}:DERIVED:${sizeId}`;

const mergeImages = (primary: string[], secondary: string[]): string[] => {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const src of [...primary, ...secondary]) {
    if (!src) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    merged.push(src);
  }
  return merged;
};

const formatVariantLabel = (variant?: VariantSummary | null) => {
  if (!variant) return null;
  if (variant.label && variant.label.trim().length > 0) {
    return variant.label;
  }
  const parts =
    variant.attributes?.map((attribute) => attribute.label ?? attribute.value ?? attribute.valueKey) ?? [];
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" / ");
};

const isVariantPurchasable = (variant?: VariantSummary | null) =>
  Boolean(variant && variant.isActive && variant.inventoryStatus !== "out-of-stock");

const toInventoryStatus = (value?: string | InventoryStatus | null): InventoryStatus => {
  if (!value) return "in-stock";
  const normalized = value.toString().toLowerCase();
  switch (normalized) {
    case "in-stock":
    case "in_stock":
    case "instock":
      return "in-stock";
    case "limited":
      return "limited";
    case "back-order":
    case "back_order":
    case "backorder":
      return "back-order";
    case "out-of-stock":
    case "out_of_stock":
    case "outofstock":
      return "out-of-stock";
    default:
      return "in-stock";
  }
};

const computeInitialSelection = (
  variants: VariantSummary[],
  attributes: ProductAttributeDefinition[]
): SelectedAttributeMap => {
  if (!variants.length || !attributes.length) {
    return {};
  }
  const preferredVariant =
    variants.find((variant) => isVariantPurchasable(variant)) ??
    variants.find((variant) => variant.isActive) ??
    variants[0];

  if (preferredVariant) {
    const selection: SelectedAttributeMap = {};
    preferredVariant.attributes.forEach((attribute) => {
      selection[attribute.attribute] = attribute.valueKey;
    });
    return selection;
  }

  const fallbackSelection: SelectedAttributeMap = {};
  attributes.forEach((attribute) => {
    const firstValue = attribute.values[0];
    if (firstValue) {
      fallbackSelection[attribute.type] = firstValue.key;
    }
  });
  return fallbackSelection;
};

const matchesVariant = (variant: VariantSummary, selection: SelectedAttributeMap, types: ProductAttributeType[]) =>
  types.every((type) => {
    const selectedValue = selection[type];
    if (!selectedValue) return false;
    return variant.attributes.some((attribute) => attribute.attribute === type && attribute.valueKey === selectedValue);
  });

const findVariantForValue = (
  variants: VariantSummary[],
  attributeType: ProductAttributeType,
  valueKey: string
): VariantSummary | undefined =>
  variants.find((variant) =>
    variant.attributes.some((attribute) => attribute.attribute === attributeType && attribute.valueKey === valueKey)
  );

const deriveCanonicalPublishedParametricSelection = (
  variants: PublishedParametricVariantSummary[],
  canonicalConfiguration?: CanonicalConfiguration | null
) => {
  if (!canonicalConfiguration || variants.length === 0) {
    return null;
  }

  const canonicalRules = canonicalConfiguration.configurationRules;
  if (!canonicalRules || typeof canonicalRules !== "object" || Array.isArray(canonicalRules)) {
    return null;
  }

  const rules = canonicalRules as Record<string, unknown>;
  const baseSelection = toPublishedParametricSelection(variants[0]);
  const wantsShutter = Boolean(
    rules.hasShutterMonoblock ?? rules.monoblock ?? rules.monoblockEnabled
  );
  const requestedSelection = {
    ...baseSelection,
    hasShutterMonoblock: wantsShutter,
    shutterMaterial:
      typeof rules.shutterMaterial === "string"
        ? rules.shutterMaterial
        : typeof rules.shutterSystem === "string"
          ? rules.shutterSystem
          : typeof rules.monoblockMaterial === "string"
            ? rules.monoblockMaterial
            : "",
  };

  if (wantsShutter) {
    const shutterVariant =
      variants.find(
        (variant) =>
          variant.optionValues.serie === requestedSelection.serie &&
          variant.optionValues.material === requestedSelection.material &&
          variant.optionValues.color === requestedSelection.color &&
          variant.optionValues.vidrio === requestedSelection.vidrio &&
          variant.optionValues.hasMosquitero === requestedSelection.hasMosquitero &&
          variant.optionValues.hasShutterMonoblock &&
          (!requestedSelection.shutterMaterial ||
            variant.optionValues.shutterMaterial === requestedSelection.shutterMaterial)
      ) ??
      variants.find(
        (variant) =>
          variant.optionValues.serie === requestedSelection.serie &&
          variant.optionValues.material === requestedSelection.material &&
          variant.optionValues.color === requestedSelection.color &&
          variant.optionValues.vidrio === requestedSelection.vidrio &&
          variant.optionValues.hasMosquitero === requestedSelection.hasMosquitero &&
          variant.optionValues.hasShutterMonoblock
      );

    if (shutterVariant) {
      return toPublishedParametricSelection(shutterVariant);
    }
  }

  return resolvePublishedParametricSelection(variants, requestedSelection, baseSelection);
};

type AttributeOptionProps = {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  colorHex?: string | null;
  imageUrl?: string | null;
  tooltip?: string | null;
};

function AttributeOptionButton({
  label,
  selected,
  disabled,
  onClick,
  colorHex,
  imageUrl,
  tooltip
}: AttributeOptionProps) {
  const button = (
    <Button
      size="small"
      variant={selected ? "contained" : "outlined"}
      disabled={disabled}
      onClick={onClick}
      type="button"
      title={tooltip ?? undefined}
      style={{
        minWidth: 60,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        opacity: disabled ? 0.5 : 1
      }}>
      {(imageUrl || colorHex) && (
        <span
          style={{
            height: 20,
            width: 20,
            borderRadius: "9999px",
            border: "1px solid rgba(0,0,0,0.15)",
            backgroundColor: imageUrl ? undefined : colorHex ?? "#FFFFFF",
            backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
            backgroundSize: "cover"
          }}
        />
      )}
      <span>{label}</span>
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <span title={tooltip} style={{ display: "inline-flex" }}>
      {button}
    </span>
  );
}

// ========================================
interface Props {
  id: string | number;
  slug?: string;
  price: number;
  title: string;
  images?: string[];
  currency?: string;
  basePrice?: number;
  discount?: number;
  rating?: number;
  ratingCount?: number;
  brand?: string;
  status?: string;
  shortDescription?: string;
  mode?: ProductMode;
  configuration?: Record<string, unknown> | null;
  canonicalConfiguration?: CanonicalConfiguration | null;
  publishedParametricOptions?: PublishedParametricOptions;
  onPublishedParametricVariantChange?: (payload: {
    specifications: Array<{ label: string; value: string }>;
    configuration: Record<string, unknown>;
  } | null) => void;
  variantAttributes?: ProductAttributeDefinition[];
  variants?: Array<{
    id: number;
    key: string;
    label?: string;
    sku?: string | null;
    price: number;
    currency: string;
    inventoryStatus: InventoryStatus;
    attributes: ProductVariantAttribute[];
    images: string[];
    isActive: boolean;
  }>;
}
// ========================================

export default function ProductIntro({
  images,
  title,
  price,
  id,
  slug,
  currency,
  basePrice,
  discount,
  rating,
  ratingCount,
  brand,
  status,
  shortDescription,
  mode = "simple",
  configuration,
  canonicalConfiguration,
  publishedParametricOptions,
  onPublishedParametricVariantChange,
  variantAttributes,
  variants
}: Props) {
  const param = useParams<{ slug?: string | string[] }>() ?? {};
  const searchParams = useSearchParams();
  const rawSlug = param.slug;
  const fallbackSlug =
    typeof rawSlug === "string"
      ? rawSlug
      : Array.isArray(rawSlug)
        ? rawSlug[0]
        : undefined;
  const productSlug = slug ?? fallbackSlug ?? String(id);

  const { items, addItemSnapshot, updateQuantity } = useCart();
  const { formatAmount, baseCurrency } = useMoneyFormatter();
  const t = useTranslation();

  const normalizedAttributes = useMemo(() => {
    if (!variantAttributes || variantAttributes.length === 0) {
      return [] as ProductAttributeDefinition[];
    }
    const orderIndex = (type: ProductAttributeType) => {
      const index = ATTRIBUTE_ORDER.indexOf(type);
      return index === -1 ? ATTRIBUTE_ORDER.length : index;
    };
    return [...variantAttributes]
      .sort((a, b) => orderIndex(a.type) - orderIndex(b.type))
      .map((attribute) => ({
        ...attribute,
        values: [...attribute.values].sort(
          (a, b) => (a.sortOrder ?? a.id ?? 0) - (b.sortOrder ?? b.id ?? 0)
        )
      }));
  }, [variantAttributes]);

  const normalizedVariants = useMemo(() => (variants ? [...variants] : []), [variants]);
  const publishedParametricVariants = useMemo(
    () => publishedParametricOptions?.variants ?? [],
    [publishedParametricOptions]
  );
  const attributeTypes = useMemo<ProductAttributeType[]>(
    () => normalizedAttributes.map((attribute) => attribute.type),
    [normalizedAttributes]
  );

  const initialSelection = useMemo(
    () => computeInitialSelection(normalizedVariants, normalizedAttributes),
    [normalizedVariants, normalizedAttributes]
  );

  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttributeMap>(initialSelection);
  const defaultPublishedParametricVariant = useMemo(
    () =>
      publishedParametricVariants.find((variant) => variant.key === publishedParametricOptions?.defaultVariantKey) ??
      publishedParametricVariants[0] ??
      null,
    [publishedParametricOptions?.defaultVariantKey, publishedParametricVariants]
  );
  const canonicalPublishedParametricSelection = useMemo(
    () => deriveCanonicalPublishedParametricSelection(publishedParametricVariants, canonicalConfiguration ?? null),
    [canonicalConfiguration, publishedParametricVariants]
  );
  const [selectedPublishedParametric, setSelectedPublishedParametric] = useState<PublishedParametricSelection>(
    canonicalPublishedParametricSelection ?? toPublishedParametricSelection(defaultPublishedParametricVariant)
  );
  const searchParamsSignature = useMemo(() => searchParams?.toString() ?? "", [searchParams]);

  useEffect(() => {
    setSelectedAttributes(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    setSelectedPublishedParametric(
      canonicalPublishedParametricSelection ?? toPublishedParametricSelection(defaultPublishedParametricVariant)
    );
  }, [canonicalPublishedParametricSelection, defaultPublishedParametricVariant]);

  useEffect(() => {
    if (!defaultPublishedParametricVariant || !searchParams || searchParamsSignature.length === 0) {
      return;
    }

    const defaultSelection =
      canonicalPublishedParametricSelection ?? toPublishedParametricSelection(defaultPublishedParametricVariant);
    const requestedSelection = selectionFromSearchParams(
      searchParams,
      defaultSelection
    );
    const resolvedSelection = resolvePublishedParametricSelection(
      publishedParametricVariants,
      requestedSelection,
      defaultSelection
    );
    setSelectedPublishedParametric(resolvedSelection);
  }, [
    canonicalPublishedParametricSelection,
    defaultPublishedParametricVariant,
    publishedParametricVariants,
    searchParams,
    searchParamsSignature
  ]);

  const selectedVariant = useMemo(() => {
    if (!attributeTypes.length) {
      return null;
    }
    const activeMatch = normalizedVariants.find(
      (variant) => variant.isActive && matchesVariant(variant, selectedAttributes, attributeTypes)
    );
    if (activeMatch) {
      return activeMatch;
    }
    return normalizedVariants.find((variant) => matchesVariant(variant, selectedAttributes, attributeTypes)) ?? null;
  }, [attributeTypes, normalizedVariants, selectedAttributes]);

  const isVariableProduct = mode === "variable" && normalizedAttributes.length > 0 && normalizedVariants.length > 0;
  const isPublishedParametricProduct =
    mode === "parametric" && publishedParametricVariants.length > 0 && Boolean(publishedParametricOptions);
  const selectedPublishedParametricVariant = useMemo(() => {
    if (!isPublishedParametricProduct) {
      return null;
    }
    return (
      publishedParametricVariants.find((variant) =>
        matchesPublishedParametricVariant(variant, selectedPublishedParametric)
      ) ?? defaultPublishedParametricVariant
    );
  }, [
    defaultPublishedParametricVariant,
    isPublishedParametricProduct,
    publishedParametricVariants,
    selectedPublishedParametric
  ]);

  useEffect(() => {
    if (!onPublishedParametricVariantChange) {
      return;
    }
    if (!isPublishedParametricProduct || !selectedPublishedParametricVariant) {
      onPublishedParametricVariantChange(null);
      return;
    }
    onPublishedParametricVariantChange({
      specifications: selectedPublishedParametricVariant.specifications,
      configuration: selectedPublishedParametricVariant.configuration
    });
  }, [
    isPublishedParametricProduct,
    onPublishedParametricVariantChange,
    selectedPublishedParametricVariant
  ]);
  const variantLabel = formatVariantLabel(selectedVariant);
  const variantIsPurchasable = isPublishedParametricProduct ? true : isVariantPurchasable(selectedVariant);
  const inventoryStatus = toInventoryStatus(selectedVariant?.inventoryStatus ?? status);
  const formattedStatus = t(formatInventoryStatus(inventoryStatus));

  const baseGallery = useMemo(() => filterValidProductImages(images ?? []), [images]);
  const variantGallery = useMemo(
    () => filterValidProductImages(selectedVariant?.images ?? []),
    [selectedVariant?.images]
  );
  const gallery = useMemo(() => {
    if (variantGallery.length) {
      return mergeImages(variantGallery, baseGallery);
    }
    return baseGallery;
  }, [baseGallery, variantGallery]);

  const hasGallery = gallery.length > 0;
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    setSelectedImage(0);
  }, [gallery]);

  useEffect(() => {
    if (!hasGallery) {
      setSelectedImage(0);
      return;
    }
    if (selectedImage >= gallery.length) {
      setSelectedImage(0);
    }
  }, [gallery, hasGallery, selectedImage]);

  const productNumericId = useMemo(() => {
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [id]);

  const derivedM2Configuration =
    configuration && typeof configuration === "object"
      ? (configuration as Record<string, unknown>)
      : null;
  const derivedSizeId = useMemo(() => {
    if (!derivedM2Configuration) {
      return null;
    }
    const candidate = Number(derivedM2Configuration.sizeId ?? derivedM2Configuration.reference);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  }, [derivedM2Configuration]);
  const isDerivedM2Product = Boolean(derivedM2Configuration?.derived === true && derivedSizeId);

  const productBrand = brand ?? t("product.brand.default", { defaultMessage: "Store brand" });

  const variantId = selectedVariant?.id;
  const lineId = isPublishedParametricProduct
    ? buildPublishedParametricLineId(id, selectedPublishedParametricVariant?.key ?? "default")
    : isDerivedM2Product && derivedSizeId
    ? buildDerivedLineId(id, derivedSizeId)
    : buildLineId(id, variantId);

  const currentLineItem = useMemo(
    () => items.find((item) => item.product.id === lineId) ?? null,
    [items, lineId]
  );
  const currentQuantity = currentLineItem?.quantity ?? 0;

  const resolvedCurrency =
    selectedPublishedParametricVariant?.price.currency ??
    selectedVariant?.currency ??
    currency ??
    baseCurrency;
  const resolvedPrice =
    selectedPublishedParametricVariant?.price.amount ??
    selectedVariant?.price ??
    price;
  const resolvedDisplayPrice = formatAmount(resolvedPrice, resolvedCurrency);

  const referencePrice = basePrice ?? price;
  const computedDiscount =
    referencePrice > resolvedPrice
      ? Math.max(0, Math.round(((referencePrice - resolvedPrice) / referencePrice) * 100))
      : discount;
  const referencePriceLabel =
    referencePrice > resolvedPrice ? formatAmount(referencePrice, resolvedCurrency) : null;

  const resolvedThumbnail = gallery[0];

  const handleAttributeSelect = useCallback(
    (attributeType: ProductAttributeType, valueKey: string) => {
      setSelectedAttributes((prev) => {
        const nextSelection: SelectedAttributeMap = { ...prev, [attributeType]: valueKey };
        if (!attributeTypes.every((type) => nextSelection[type])) {
          const fallbackVariant = findVariantForValue(normalizedVariants, attributeType, valueKey);
          if (fallbackVariant) {
            const adjusted: SelectedAttributeMap = {};
            fallbackVariant.attributes.forEach((attribute) => {
              adjusted[attribute.attribute] = attribute.valueKey;
            });
            return adjusted;
          }
          return nextSelection;
        }
        if (!normalizedVariants.some((variant) => matchesVariant(variant, nextSelection, attributeTypes))) {
          const fallbackVariant = findVariantForValue(normalizedVariants, attributeType, valueKey);
          if (fallbackVariant) {
            const adjusted: SelectedAttributeMap = {};
            fallbackVariant.attributes.forEach((attribute) => {
              adjusted[attribute.attribute] = attribute.valueKey;
            });
            return adjusted;
          }
        }
        return nextSelection;
      });
    },
    [attributeTypes, normalizedVariants]
  );

  const isOptionSelectable = useCallback(
    (attributeType: ProductAttributeType, valueKey: string) =>
      normalizedVariants.some((variant) => {
        if (!variant.isActive) {
          return false;
        }
        if (variant.inventoryStatus === "out-of-stock") {
          return false;
        }
        return variant.attributes.every((attribute) => {
          if (attribute.attribute === attributeType) {
            return attribute.valueKey === valueKey;
          }
          const selected = selectedAttributes[attribute.attribute];
          if (!selected) return true;
          return attribute.valueKey === selected;
        });
      }),
    [normalizedVariants, selectedAttributes]
  );

  const updatePublishedParametricSelection = useCallback(
    (patch: Partial<PublishedParametricSelection>) => {
      setSelectedPublishedParametric((prev) => {
        const nextSelection: PublishedParametricSelection = { ...prev, ...patch };
        if (patch.hasShutterMonoblock === false) {
          nextSelection.shutterMaterial = "";
        }
        return resolvePublishedParametricSelection(publishedParametricVariants, nextSelection, prev);
      });
    },
    [publishedParametricVariants]
  );

  const isPublishedParametricFieldSelectable = useCallback(
    (field: keyof PublishedParametricSelection, value: string | boolean) =>
      isPublishedParametricOptionSelectable(
        publishedParametricVariants,
        selectedPublishedParametric,
        field,
        value
      ),
    [publishedParametricVariants, selectedPublishedParametric]
  );

  const availableShutterMaterials = useMemo(() => {
    if (!selectedPublishedParametric.hasShutterMonoblock) {
      return [] as string[];
    }
    const materials = new Set<string>();
    publishedParametricVariants.forEach((variant) => {
      if (
        variant.optionValues.serie === selectedPublishedParametric.serie &&
        variant.optionValues.material === selectedPublishedParametric.material &&
        variant.optionValues.color === selectedPublishedParametric.color &&
        variant.optionValues.vidrio === selectedPublishedParametric.vidrio &&
        variant.optionValues.hasMosquitero === selectedPublishedParametric.hasMosquitero &&
        variant.optionValues.hasShutterMonoblock
      ) {
        const material = variant.optionValues.shutterMaterial?.trim();
        if (material) {
          materials.add(material);
        }
      }
    });
    return Array.from(materials);
  }, [publishedParametricVariants, selectedPublishedParametric]);

  const publishedParametricAvailability = useMemo(() => {
    const mosquitoYesVariant = findPreferredPublishedParametricVariant(
      publishedParametricVariants,
      selectedPublishedParametric,
      "hasMosquitero",
      true
    );
    const mosquitoNoVariant = findPreferredPublishedParametricVariant(
      publishedParametricVariants,
      selectedPublishedParametric,
      "hasMosquitero",
      false
    );
    const shutterYesVariant = findPreferredPublishedParametricVariant(
      publishedParametricVariants,
      selectedPublishedParametric,
      "hasShutterMonoblock",
      true
    );
    const shutterNoVariant = findPreferredPublishedParametricVariant(
      publishedParametricVariants,
      selectedPublishedParametric,
      "hasShutterMonoblock",
      false
    );

    return {
      mosquitoYesVariant,
      mosquitoNoVariant,
      shutterYesVariant,
      shutterNoVariant
    };
  }, [publishedParametricVariants, selectedPublishedParametric]);

  const addToCartDisabled =
    (isVariableProduct && (!selectedVariant || !variantIsPurchasable)) ||
    (isPublishedParametricProduct && !selectedPublishedParametricVariant) ||
    (!isVariableProduct && false);

  const selectedAttributesSummary = useMemo(() => {
    if (!isVariableProduct) {
      return [];
    }
    return normalizedAttributes.map((attribute) => {
      const selectedKey = selectedAttributes[attribute.type];
      const selectedValue = attribute.values.find((value) => value.key === selectedKey);
      return {
        attribute: attribute.name ?? attribute.type,
        value: selectedValue?.label ?? selectedValue?.value ?? selectedKey ?? "-"
      };
    });
  }, [isVariableProduct, normalizedAttributes, selectedAttributes]);

  const selectedPublishedParametricSummary = useMemo(() => {
    return buildPublishedParametricSummaryEntries(selectedPublishedParametricVariant?.configuration, t, {
      includeMaterial: false
    });
  }, [selectedPublishedParametricVariant?.configuration, t]);
  const canonicalAnalyticsContext = useMemo(
    () =>
      buildCanonicalAnalyticsContext({
        canonicalConfiguration: canonicalConfiguration ?? null,
        configuration: selectedPublishedParametricVariant?.configuration ?? configuration ?? null
      }),
    [canonicalConfiguration, configuration, selectedPublishedParametricVariant?.configuration]
  );

  const handleAddToCart = useCallback(() => {
    if (addToCartDisabled) {
      return;
    }

    const productIdForCart = productNumericId ?? id;
    const variantAttributesForCart = selectedVariant?.attributes ?? undefined;
    const publishedParametricVariantLabel = selectedPublishedParametricSummary
      .map((entry) => `${entry.attribute}: ${entry.value}`)
      .join(" • ");
    const priceMoney = normalizeMoney({ amount: resolvedPrice, currency: resolvedCurrency });
    const snapshotThumbnail = resolvedThumbnail
      ? {
          id: lineId,
          url: resolvedThumbnail
        }
      : undefined;

    addItemSnapshot(
      {
        id: lineId,
        productId: productIdForCart,
        mode,
        variantId: selectedVariant?.id,
        variantKey: isPublishedParametricProduct ? selectedPublishedParametricVariant?.key : selectedVariant?.key,
        variantLabel: isPublishedParametricProduct ? publishedParametricVariantLabel : variantLabel,
        selectionSummary: isPublishedParametricProduct ? publishedParametricVariantLabel : variantLabel,
        slug: productSlug,
        name: title,
        price: priceMoney,
        salePrice: null,
        thumbnail: snapshotThumbnail,
        inventoryStatus,
        attributes: variantAttributesForCart,
        configuration: isPublishedParametricProduct
          ? selectedPublishedParametricVariant?.configuration
          : isDerivedM2Product
          ? {
              ...derivedM2Configuration,
              derived: true,
              baseProductId: productIdForCart,
              sizeId: derivedSizeId,
            }
          : undefined
      },
      1
    );

  }, [
    addItemSnapshot,
    addToCartDisabled,
    id,
    inventoryStatus,
    lineId,
    productNumericId,
    productSlug,
    resolvedCurrency,
    resolvedPrice,
    resolvedThumbnail,
    selectedVariant,
    title,
    mode,
    isPublishedParametricProduct,
    selectedPublishedParametricSummary,
    selectedPublishedParametricVariant,
    variantLabel,
    isDerivedM2Product,
    derivedM2Configuration,
    derivedSizeId
  ]);

  const handleIncreaseQuantity = useCallback(() => {
    updateQuantity(lineId, currentQuantity + 1);
  }, [currentQuantity, lineId, updateQuantity]);

  const handleDecreaseQuantity = useCallback(() => {
    updateQuantity(lineId, Math.max(0, currentQuantity - 1));
  }, [currentQuantity, lineId, updateQuantity]);

  const productRating = rating ?? 4;
  const productRatingCount = ratingCount ?? 0;

  return (
    <Box overflow="hidden">
      <Grid container justifyContent="center" alignItems="center" spacing={16}>
        <Grid item md={6} xs={12} alignItems="center">
          <div>
            <FlexBox mb="50px" overflow="hidden" borderRadius={16} justifyContent="center">
              {hasGallery ? (
                <Image
                  width={300}
                  height={300}
                  src={gallery[Math.min(selectedImage, gallery.length - 1)]}
                  alt={title}
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              ) : (
                <NoImagePlaceholder
                  width="100%"
                  height="300px"
                  borderRadius={16}
                />
              )}
            </FlexBox>

            {hasGallery ? (
              <FlexBox overflow="auto">
                {gallery.map((url, ind) => (
                  <Box
                    key={ind}
                    size={70}
                    bg="white"
                    minWidth={70}
                    display="flex"
                    cursor="pointer"
                    border="1px solid"
                    borderRadius="10px"
                    alignItems="center"
                    justifyContent="center"
                    ml={ind === 0 ? "auto" : ""}
                    mr={ind === gallery.length - 1 ? "auto" : "10px"}
                    borderColor={selectedImage === ind ? "primary.main" : "gray.400"}
                    onClick={() => setSelectedImage(ind)}>
                    <Avatar src={url} borderRadius="10px" size={65} />
                  </Box>
                ))}
              </FlexBox>
            ) : null}
          </div>
        </Grid>

        <Grid item md={6} xs={12} alignItems="center">
          <H1 data-testid="product-detail-title" mb="0.75rem">
            {title}
          </H1>
          {variantLabel ? (
            <SemiSpan color="text.muted" display="block" mb="0.5rem">
              {variantLabel}
            </SemiSpan>
          ) : null}

          {shortDescription ? (
            <Paragraph color="text.muted" mb="1rem">
              {shortDescription}
            </Paragraph>
          ) : null}

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>{t("product.labels.brand", { defaultMessage: "Brand:" })}</SemiSpan>
            <H6 ml="8px">{productBrand}</H6>
          </FlexBox>

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>{t("product.labels.rated", { defaultMessage: "Rated:" })}</SemiSpan>
            <Box ml="8px" mr="8px">
              <Rating color="warn" value={productRating} outof={5} />
            </Box>
            <H6>({productRatingCount})</H6>
          </FlexBox>

          <Box mb="24px">
            <H2 data-testid="product-detail-price" color="primary.main" mb="4px" lineHeight="1">
              {resolvedDisplayPrice}
            </H2>
            {referencePriceLabel ? (
              <SemiSpan color="text.muted" style={{ textDecoration: "line-through" }}>
                {referencePriceLabel}
              </SemiSpan>
            ) : null}
            {typeof computedDiscount === "number" && computedDiscount > 0 ? (
              <SemiSpan color="success.main" display="block" mt="0.25rem">
                {t("product.discount.savePercent", {
                  defaultMessage: "Save {discount}%",
                  values: { discount: computedDiscount }
                })}
              </SemiSpan>
            ) : null}
            <SemiSpan color="inherit" display="block" mt="0.35rem">
              {formattedStatus}
            </SemiSpan>
          </Box>

          {isVariableProduct ? (
            <Box mb="24px">
              {normalizedAttributes.map((attribute) => (
                <Box key={attribute.type} mb="18px">
                  <SemiSpan display="block" mb="8px">
                    {attribute.name ?? attribute.type}
                  </SemiSpan>
                  <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                    {attribute.values.map((value) => {
                      const selected = selectedAttributes[attribute.type] === value.key;
                      const selectable = isOptionSelectable(attribute.type, value.key);
                      return (
                        <AttributeOptionButton
                          key={value.key}
                          label={value.label ?? value.value ?? value.key}
                          selected={Boolean(selected)}
                          disabled={!selectable && !selected}
                          onClick={() => handleAttributeSelect(attribute.type, value.key)}
                          colorHex={value.colorHex}
                          imageUrl={value.imageUrl}
                        />
                      );
                    })}
                  </FlexBox>
                </Box>
              ))}
              {selectedAttributesSummary.length > 0 ? (
                <SemiSpan color="text.muted">
                  {t("product.selection.label", { defaultMessage: "Selection:" })}{" "}
                  {selectedAttributesSummary
                    .map((entry) => `${entry.attribute}: ${entry.value}`)
                    .join(" • ")}
                </SemiSpan>
              ) : null}
              {!variantIsPurchasable && selectedVariant ? (
                <Paragraph color="text.muted" mt="0.75rem">
                  {t("product.variant.unavailable", {
                    defaultMessage: "This combination is currently unavailable."
                  })}
                </Paragraph>
              ) : null}
            </Box>
          ) : null}

          {isPublishedParametricProduct ? (
            <Box mb="24px">
              {publishedParametricOptions && publishedParametricOptions.selectors.series.length > 1 ? (
                <Box mb="18px">
                  <SemiSpan display="block" mb="8px">
                    {t("product.parametric.fields.series", { defaultMessage: "Series" })}
                  </SemiSpan>
                  <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                    {publishedParametricOptions.selectors.series.map((value) => (
                      <AttributeOptionButton
                        key={`serie-${value}`}
                        label={value}
                        selected={selectedPublishedParametric.serie === value}
                        disabled={
                          !isPublishedParametricFieldSelectable("serie", value) &&
                          selectedPublishedParametric.serie !== value
                        }
                        onClick={() => updatePublishedParametricSelection({ serie: value })}
                      />
                    ))}
                  </FlexBox>
                </Box>
              ) : null}

              {publishedParametricOptions && publishedParametricOptions.selectors.materials.length > 1 ? (
                <Box mb="18px">
                  <SemiSpan display="block" mb="8px">
                    {t("product.parametric.fields.material", { defaultMessage: "Material" })}
                  </SemiSpan>
                  <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                    {publishedParametricOptions.selectors.materials.map((value) => (
                      <AttributeOptionButton
                        key={`material-${value}`}
                        label={value}
                        selected={selectedPublishedParametric.material === value}
                        disabled={
                          !isPublishedParametricFieldSelectable("material", value) &&
                          selectedPublishedParametric.material !== value
                        }
                        onClick={() => updatePublishedParametricSelection({ material: value })}
                      />
                    ))}
                  </FlexBox>
                </Box>
              ) : null}

              {publishedParametricOptions && publishedParametricOptions.selectors.colors.length > 1 ? (
                <Box mb="18px">
                  <SemiSpan display="block" mb="8px">
                    {t("product.parametric.fields.color", { defaultMessage: "Color" })}
                  </SemiSpan>
                  <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                    {publishedParametricOptions.selectors.colors.map((value) => (
                      <AttributeOptionButton
                        key={`color-${value}`}
                        label={value}
                        selected={selectedPublishedParametric.color === value}
                        disabled={
                          !isPublishedParametricFieldSelectable("color", value) &&
                          selectedPublishedParametric.color !== value
                        }
                        onClick={() => updatePublishedParametricSelection({ color: value })}
                      />
                    ))}
                  </FlexBox>
                </Box>
              ) : null}

              {publishedParametricOptions && publishedParametricOptions.selectors.glass.length > 1 ? (
                <Box mb="18px">
                  <SemiSpan display="block" mb="8px">
                    {t("product.parametric.fields.glass", { defaultMessage: "Glass" })}
                  </SemiSpan>
                  <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                    {publishedParametricOptions.selectors.glass.map((value) => (
                      <AttributeOptionButton
                        key={`glass-${value}`}
                        label={value}
                        selected={selectedPublishedParametric.vidrio === value}
                        disabled={
                          !isPublishedParametricFieldSelectable("vidrio", value) &&
                          selectedPublishedParametric.vidrio !== value
                        }
                        onClick={() => updatePublishedParametricSelection({ vidrio: value })}
                      />
                    ))}
                  </FlexBox>
                </Box>
              ) : null}

              <Box mb="18px">
                <SemiSpan display="block" mb="8px">
                  {t("product.parametric.fields.mosquito", { defaultMessage: "Mosquito net" })}
                </SemiSpan>
                <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                  <AttributeOptionButton
                    key="mosquito-no"
                    label={t("product.parametric.options.withoutMosquito", {
                      defaultMessage: "Without mosquito net"
                    })}
                    selected={!selectedPublishedParametric.hasMosquitero}
                    disabled={!publishedParametricAvailability.mosquitoNoVariant}
                    tooltip={
                      !publishedParametricAvailability.mosquitoNoVariant
                        ? t("product.parametric.tooltips.mosquito.withoutUnavailable", {
                            defaultMessage:
                              "This published combination is not available without mosquito net."
                          })
                        : undefined
                    }
                    onClick={() => {
                      const target = publishedParametricAvailability.mosquitoNoVariant;
                      if (target) {
                        setSelectedPublishedParametric(toPublishedParametricSelection(target));
                      }
                    }}
                  />
                  <AttributeOptionButton
                    key="mosquito-yes"
                    label={t("product.parametric.options.withMosquito", {
                      defaultMessage: "With mosquito net"
                    })}
                    selected={selectedPublishedParametric.hasMosquitero}
                    disabled={!publishedParametricAvailability.mosquitoYesVariant}
                    tooltip={
                      !publishedParametricAvailability.mosquitoYesVariant
                        ? t("product.parametric.tooltips.mosquito.withUnavailable", {
                            defaultMessage:
                              "This published combination is not available with mosquito net."
                          })
                        : undefined
                    }
                    onClick={() => {
                      const target = publishedParametricAvailability.mosquitoYesVariant;
                      if (target) {
                        setSelectedPublishedParametric(toPublishedParametricSelection(target));
                      }
                    }}
                  />
                </FlexBox>
              </Box>

              <Box mb="18px">
                <SemiSpan display="block" mb="8px">
                  {t("product.parametric.fields.monoblock", { defaultMessage: "Monoblock" })}
                </SemiSpan>
                <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                  <AttributeOptionButton
                    key="shutter-no"
                    label={t("product.parametric.options.withoutShutter", {
                      defaultMessage: "Without shutter"
                    })}
                    selected={!selectedPublishedParametric.hasShutterMonoblock}
                    disabled={!publishedParametricAvailability.shutterNoVariant}
                    tooltip={
                      !publishedParametricAvailability.shutterNoVariant
                        ? t("product.parametric.tooltips.shutter.withoutUnavailable", {
                            defaultMessage:
                              "This published combination is not available without shutter."
                          })
                        : undefined
                    }
                    onClick={() => {
                      const target = publishedParametricAvailability.shutterNoVariant;
                      if (target) {
                        setSelectedPublishedParametric(toPublishedParametricSelection(target));
                      }
                    }}
                  />
                  <AttributeOptionButton
                    key="shutter-yes"
                    label={t("product.parametric.options.withShutter", {
                      defaultMessage: "With shutter"
                    })}
                    selected={selectedPublishedParametric.hasShutterMonoblock}
                    disabled={!publishedParametricAvailability.shutterYesVariant}
                    tooltip={
                      !publishedParametricAvailability.shutterYesVariant
                        ? t("product.parametric.tooltips.shutter.withUnavailable", {
                            defaultMessage:
                              "This published combination is not available with shutter."
                          })
                        : undefined
                    }
                    onClick={() => {
                      const target = publishedParametricAvailability.shutterYesVariant;
                      if (target) {
                        setSelectedPublishedParametric(toPublishedParametricSelection(target));
                      }
                    }}
                  />
                </FlexBox>
              </Box>

              {selectedPublishedParametric.hasShutterMonoblock &&
              availableShutterMaterials.length > 0 ? (
                <Box mb="18px">
                  <SemiSpan display="block" mb="8px">
                    {t("product.parametric.fields.shutterMaterial", {
                      defaultMessage: "Shutter material"
                    })}
                  </SemiSpan>
                  <FlexBox flexWrap="wrap" style={{ gap: "0.5rem" }}>
                    {availableShutterMaterials.map((value) => {
                      const targetVariant = findPreferredPublishedParametricVariant(
                        publishedParametricVariants,
                        selectedPublishedParametric,
                        "shutterMaterial",
                        value
                      );

                      return (
                        <AttributeOptionButton
                          key={`shutter-${value}`}
                          label={value}
                          selected={selectedPublishedParametric.shutterMaterial === value}
                          disabled={!targetVariant}
                          tooltip={
                            !targetVariant
                              ? t("product.parametric.tooltips.shutter.materialUnavailable", {
                                  defaultMessage:
                                    "This shutter material is not available for the selected combination."
                                })
                              : undefined
                          }
                          onClick={() => {
                            if (targetVariant) {
                              setSelectedPublishedParametric(toPublishedParametricSelection(targetVariant));
                            }
                          }}
                        />
                      );
                    })}
                  </FlexBox>
                </Box>
              ) : null}

              {selectedPublishedParametricSummary.length > 0 ? (
                <SemiSpan color="text.muted">
                  {t("product.selection.label", { defaultMessage: "Selection:" })}{" "}
                  {selectedPublishedParametricSummary
                    .map((entry) => `${entry.attribute}: ${entry.value}`)
                    .join(" • ")}
                </SemiSpan>
              ) : null}
            </Box>
          ) : null}

          {currentQuantity === 0 ? (
            <FlexBox alignItems="center" mb="36px" style={{ gap: "0.75rem" }}>
              <TrackedButton
                size="small"
                color="primary"
                variant="contained"
                disabled={addToCartDisabled}
                data-testid="product-detail-add-to-cart"
                eventName="add_to_cart"
                eventCategory="ecommerce"
                pageType="product"
                componentType="product_intro"
                componentId="product_intro_primary_cta"
                ctaId="product.detail.add_to_cart.primary"
                ctaName="add_to_cart"
                ctaType="primary"
                ctaContext="ecommerce"
                ctaLocation="product_detail"
                metadata={{
                  product_id: productNumericId ?? id,
                  product_slug: productSlug,
                  variant_id: selectedVariant?.id ?? null,
                  variant_key: isPublishedParametricProduct ? selectedPublishedParametricVariant?.key : selectedVariant?.key ?? null,
                  price: resolvedPrice,
                  currency: resolvedCurrency,
                  quantity: 1,
                  ...canonicalAnalyticsContext
                }}
                onClick={handleAddToCart}>
                {t("product.actions.addToCart", { defaultMessage: "Add to Cart" })}
              </TrackedButton>

              <ProductWishlistButton productId={productNumericId} />
            </FlexBox>
          ) : (
            <FlexBox alignItems="center" mb="36px" style={{ gap: "0.75rem" }}>
              <Button
                p="9px"
                size="small"
                color="primary"
                variant="outlined"
                data-testid="product-detail-decrease"
                onClick={handleDecreaseQuantity}>
                <IconMinus size={22} />
              </Button>

              <H3 fontWeight="600" mx="20px">
                {currentQuantity.toString().padStart(2, "0")}
              </H3>

              <Button
                p="9px"
                size="small"
                color="primary"
                variant="outlined"
                data-testid="product-detail-increase"
                onClick={handleIncreaseQuantity}>
                <IconPlus size={22} />
              </Button>

              <ProductWishlistButton productId={productNumericId} />
            </FlexBox>
          )}

          {brand ? (
            <FlexBox alignItems="center" mb="1rem">
              <SemiSpan>{t("product.labels.brand", { defaultMessage: "Brand:" })}</SemiSpan>
              <H6 lineHeight="1" ml="8px">
                {brand}
              </H6>
            </FlexBox>
          ) : null}
        </Grid>
      </Grid>
    </Box>
  );
}
