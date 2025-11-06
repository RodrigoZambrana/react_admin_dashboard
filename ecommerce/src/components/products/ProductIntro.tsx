"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import ProductWishlistButton from "@component/product-cards/ProductWishlistButton";
import ParametricConfigurator from "./ParametricConfigurator";

import useCart from "@hook/useCart";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { formatInventoryStatus, normalizeMoney } from "@/lib/utils/format";
import { filterValidProductImages } from "@/lib/utils/image";
import type {
  InventoryStatus,
  ProductAttributeDefinition,
  ProductAttributeType,
  ProductMode,
  ProductVariantAttribute
} from "@/types/storefront";

const ATTRIBUTE_ORDER: ProductAttributeType[] = ["COLOR", "SIZE", "MATERIAL"];

type SelectedAttributeMap = Partial<Record<ProductAttributeType, string>>;

type VariantSummary = NonNullable<Props["variants"]>[number];

const buildLineId = (productId: string | number, variantId?: number) =>
  variantId !== undefined && variantId !== null ? `${String(productId)}:${variantId}` : String(productId);

const sanitizeCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const buildParametricLineId = (
  productId: string | number,
  config: {
    width: number;
    height: number;
    series: string;
    color: string;
    glass: string;
    mosquitoNet: boolean;
    monoblock?: { enabled: boolean; material?: string; color?: string };
  }
) => {
  const widthKey = Math.round(config.width * 1000);
  const heightKey = Math.round(config.height * 1000);
  const seriesKey = sanitizeCode(config.series);
  const colorKey = sanitizeCode(config.color);
  const glassKey = sanitizeCode(config.glass);
  const mosquitoKey = config.mosquitoNet ? 'MSQ1' : 'MSQ0';
  const monoblockKey = config.monoblock?.enabled
    ? `MB-${sanitizeCode(config.monoblock.material ?? 'UNK')}-${sanitizeCode(
        config.monoblock.color ?? 'UNK'
      )}`
    : 'MB-0';
  return `${productId}:PARAM:${widthKey}x${heightKey}:${seriesKey}:${colorKey}:${glassKey}:${mosquitoKey}:${monoblockKey}`;
};

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

type AttributeOptionProps = {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  colorHex?: string | null;
  imageUrl?: string | null;
};

function AttributeOptionButton({
  label,
  selected,
  disabled,
  onClick,
  colorHex,
  imageUrl
}: AttributeOptionProps) {
  return (
    <Button
      size="small"
      variant={selected ? "contained" : "outlined"}
      disabled={disabled}
      onClick={onClick}
      type="button"
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
  variantAttributes,
  variants
}: Props) {
  const param = useParams<{ slug?: string | string[] }>() ?? {};
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
  const attributeTypes = useMemo<ProductAttributeType[]>(
    () => normalizedAttributes.map((attribute) => attribute.type),
    [normalizedAttributes]
  );

  const initialSelection = useMemo(
    () => computeInitialSelection(normalizedVariants, normalizedAttributes),
    [normalizedVariants, normalizedAttributes]
  );

  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttributeMap>(initialSelection);

  useEffect(() => {
    setSelectedAttributes(initialSelection);
  }, [initialSelection]);

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
  const isParametricProduct = mode === "parametric";
  const variantLabel = formatVariantLabel(selectedVariant);
  const variantIsPurchasable = isVariantPurchasable(selectedVariant);
  const inventoryStatus = toInventoryStatus(selectedVariant?.inventoryStatus ?? status);
  const formattedStatus = formatInventoryStatus(inventoryStatus);

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

  const productBrand = brand ?? "Store brand";
  const parametricProductId = useMemo(() => {
    if (typeof id === "number") return id;
    if (productNumericId) return productNumericId;
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [id, productNumericId]);

  const variantId = selectedVariant?.id;
  const lineId = buildLineId(id, variantId);

  if (isParametricProduct) {
    const productIdForConfigurator = parametricProductId ?? productNumericId;

    return (
      <ParametricConfigurator
        product={{
          id: String(productIdForConfigurator ?? id),
          slug: productSlug,
          title,
          shortDescription,
          brand: productBrand,
          rating: rating ?? 0,
          ratingCount: ratingCount ?? 0,
          currency: currency ?? baseCurrency,
          status
        }}
        gallery={gallery}
        hasGallery={hasGallery}
        selectedImage={selectedImage}
        onSelectImage={(index) => setSelectedImage(index)}
      />
    );
  }

  const currentLineItem = useMemo(
    () => items.find((item) => item.product.id === lineId) ?? null,
    [items, lineId]
  );
  const currentQuantity = currentLineItem?.quantity ?? 0;

  const resolvedCurrency = selectedVariant?.currency ?? currency ?? baseCurrency;
  const resolvedPrice = selectedVariant?.price ?? price;
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

  const addToCartDisabled =
    (isVariableProduct && (!selectedVariant || !variantIsPurchasable)) || (!isVariableProduct && false);

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

  const handleAddToCart = useCallback(() => {
    if (addToCartDisabled) {
      return;
    }

    const productIdForCart = productNumericId ?? id;
    const variantAttributesForCart = selectedVariant?.attributes ?? undefined;
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
        variantId: selectedVariant?.id,
        variantKey: selectedVariant?.key,
        variantLabel: variantLabel,
        slug: productSlug,
        name: title,
        price: priceMoney,
        salePrice: null,
        thumbnail: snapshotThumbnail,
        inventoryStatus,
        attributes: variantAttributesForCart
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
    variantLabel
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
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              ) : (
                <NoImagePlaceholder
                  width="100%"
                  height="300px"
                  text="No image available"
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
          <H1 mb="0.75rem">{title}</H1>
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
            <SemiSpan>Brand:</SemiSpan>
            <H6 ml="8px">{productBrand}</H6>
          </FlexBox>

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>Rated:</SemiSpan>
            <Box ml="8px" mr="8px">
              <Rating color="warn" value={productRating} outof={5} />
            </Box>
            <H6>({productRatingCount})</H6>
          </FlexBox>

          <Box mb="24px">
            <H2 color="primary.main" mb="4px" lineHeight="1">
              {resolvedDisplayPrice}
            </H2>
            {referencePriceLabel ? (
              <SemiSpan color="text.muted" style={{ textDecoration: "line-through" }}>
                {referencePriceLabel}
              </SemiSpan>
            ) : null}
            {typeof computedDiscount === "number" && computedDiscount > 0 ? (
              <SemiSpan color="success.main" display="block" mt="0.25rem">
                Save {computedDiscount}%
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
                  Selection:{" "}
                  {selectedAttributesSummary
                    .map((entry) => `${entry.attribute}: ${entry.value}`)
                    .join(" • ")}
                </SemiSpan>
              ) : null}
              {!variantIsPurchasable && selectedVariant ? (
                <Paragraph color="text.muted" mt="0.75rem">
                  This combination is currently unavailable.
                </Paragraph>
              ) : null}
            </Box>
          ) : null}

          {currentQuantity === 0 ? (
            <FlexBox alignItems="center" mb="36px" style={{ gap: "0.75rem" }}>
              <Button
                size="small"
                color="primary"
                variant="contained"
                disabled={addToCartDisabled}
                onClick={handleAddToCart}>
                Add to Cart
              </Button>

              <ProductWishlistButton productId={productNumericId} />
            </FlexBox>
          ) : (
            <FlexBox alignItems="center" mb="36px" style={{ gap: "0.75rem" }}>
              <Button
                p="9px"
                size="small"
                color="primary"
                variant="outlined"
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
                onClick={handleIncreaseQuantity}>
                <IconPlus size={22} />
              </Button>

              <ProductWishlistButton productId={productNumericId} />
            </FlexBox>
          )}

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>Sold By:</SemiSpan>
            <Link href="/shops/scarlett-beauty">
              <H6 lineHeight="1" ml="8px">
                Mobile Store
              </H6>
            </Link>
          </FlexBox>
        </Grid>
      </Grid>
    </Box>
  );
}
