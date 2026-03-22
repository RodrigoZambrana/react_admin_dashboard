"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Box from "@component/Box";
import Image from "@component/Image";
import Avatar from "@component/avatar";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { Button } from "@component/buttons";
import { H1, H2, Paragraph, SemiSpan } from "@component/Typography";
import Rating from "@component/rating";
import Switcher from "@component/switch";
import Select from "@component/Select";
import TextField from "@component/text-field";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { normalizeMoney } from "@/lib/utils/format";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import useCart from "@hook/useCart";
import type Product from "@models/product.model";
import type { CartProductSnapshot } from "@/state/cart-context";
import { useTranslation } from "@/state/i18n-context";
import type {
  InventoryStatus,
  ParametricConfigSnapshot,
  ParametricQuoteRequest,
  ParametricQuoteResult,
} from "@/types/storefront";

type ParametricOption = {
  value: string;
  label: string;
};

type ParametricFormState = {
  familyId: string;
  serie: string;
  material: string;
  color: string;
  vidrio: string;
  widthMm: string;
  heightMm: string;
  hasMosquitero: boolean;
  hasShutterMonoblock: boolean;
  shutterMaterial: string;
};

type ParametricProductInfo = Pick<
  Product,
  | "id"
  | "slug"
  | "title"
  | "shortDescription"
  | "brand"
  | "rating"
  | "ratingCount"
  | "currency"
  | "status"
  | "mode"
>;

type ParametricConfiguratorProps = {
  product: ParametricProductInfo;
  gallery: string[];
  hasGallery: boolean;
  selectedImage: number;
  onSelectImage: (index: number) => void;
};

const sanitizeNumber = (value: string) => value.replace(/[^\d]/g, "");

const sanitizeCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const normalizeInventoryStatus = (status?: string | null): InventoryStatus => {
  const normalized = (status ?? "").toLowerCase();
  if (["in-stock", "instock", "in_stock", "available"].includes(normalized)) {
    return "in-stock";
  }
  if (["limited", "low-stock", "low", "limited_stock"].includes(normalized)) {
    return "limited";
  }
  if (["back-order", "backorder", "back_order"].includes(normalized)) {
    return "back-order";
  }
  if (["out-of-stock", "out", "sold-out", "sold_out"].includes(normalized)) {
    return "out-of-stock";
  }
  return "in-stock";
};

const parseMm = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickFirst = <T,>(values: T[], fallback: T): T => (values.length ? values[0] : fallback);

const createDefaultForm = (config: ParametricConfigSnapshot): ParametricFormState => {
  const { selectors, compatibility } = config;
  const serie = pickFirst(selectors.series, "");
  const allowedGlass = compatibility.glassBySeries?.[serie];
  const initialGlass = pickFirst(
    selectors.glass.filter((item) => !allowedGlass || allowedGlass.length === 0 || allowedGlass.includes(item)),
    pickFirst(selectors.glass, ""),
  );
  const sizeLimits = compatibility.sizeLimits?.[serie];
  const allowedWidths = selectors.widths.filter((value) => {
    if (typeof sizeLimits?.minWidthMm === "number" && value < sizeLimits.minWidthMm) return false;
    if (typeof sizeLimits?.maxWidthMm === "number" && value > sizeLimits.maxWidthMm) return false;
    return true;
  });
  const allowedHeights = selectors.heights.filter((value) => {
    if (typeof sizeLimits?.minHeightMm === "number" && value < sizeLimits.minHeightMm) return false;
    if (typeof sizeLimits?.maxHeightMm === "number" && value > sizeLimits.maxHeightMm) return false;
    return true;
  });
  const shutterMaterial = pickFirst(selectors.shutterMaterials, "");

  return {
    familyId: pickFirst(selectors.families, ""),
    serie,
    material: pickFirst(selectors.materials, "ALUMINIO"),
    color: pickFirst(selectors.colors, ""),
    vidrio: initialGlass,
    widthMm: String(pickFirst(allowedWidths, pickFirst(selectors.widths, 0))),
    heightMm: String(pickFirst(allowedHeights, pickFirst(selectors.heights, 0))),
    hasMosquitero: false,
    hasShutterMonoblock: false,
    shutterMaterial,
  };
};

const buildParametricLineId = (productId: string | number, config: ParametricQuoteRequest) => {
  const familyKey = sanitizeCode(config.familyId ?? "GEN");
  const seriesKey = sanitizeCode(config.serie);
  const materialKey = sanitizeCode(config.material);
  const colorKey = sanitizeCode(config.color);
  const glassKey = sanitizeCode(config.vidrio);
  const mosquitoKey = config.hasMosquitero ? "MSQ1" : "MSQ0";
  const monoblockKey = config.hasShutterMonoblock
    ? `MB-${sanitizeCode(config.shutterMaterial ?? "UNK")}`
    : "MB-0";
  return `${productId}:PARAM:${familyKey}:${seriesKey}:${materialKey}:${colorKey}:${glassKey}:${config.widthMm}x${config.heightMm}:${mosquitoKey}:${monoblockKey}`;
};

const toStringOptions = (values: string[]): ParametricOption[] =>
  values.filter(Boolean).map((value) => ({ value, label: value }));

const toNumberOptions = (values: number[]): ParametricOption[] =>
  values.map((value) => ({ value: String(value), label: `${value} mm` }));

const readOptionValue = (input: unknown): string => {
  if (typeof input === "string") {
    return input;
  }
  if (input && typeof input === "object" && "value" in input) {
    const value = (input as { value?: unknown }).value;
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return "";
};

const buildQuotePayload = (form: ParametricFormState): ParametricQuoteRequest => ({
  familyId: form.familyId || null,
  serie: form.serie,
  material: form.material,
  color: form.color,
  vidrio: form.vidrio,
  widthMm: parseMm(form.widthMm),
  heightMm: parseMm(form.heightMm),
  hasMosquitero: form.hasMosquitero,
  hasShutterMonoblock: form.hasShutterMonoblock,
  shutterMaterial: form.hasShutterMonoblock ? form.shutterMaterial : "",
});

const formatSelectorValue = (value?: string | null) => {
  if (!value || !value.trim()) {
    return "-";
  }
  return value;
};

const ParametricConfigurator = ({
  product,
  gallery,
  hasGallery,
  selectedImage,
  onSelectImage,
}: ParametricConfiguratorProps) => {
  const t = useTranslation();
  const { addItemSnapshot, items } = useCart();
  const { formatAmount, baseCurrency } = useMoneyFormatter();
  const [form, setForm] = useState<ParametricFormState | null>(null);
  const [config, setConfig] = useState<ParametricConfigSnapshot | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [quote, setQuote] = useState<ParametricQuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const numericId = Number(product.id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setConfig(null);
      setForm(null);
      setLoadingConfig(false);
      setErrorMessage(
        t("product.parametric.error.invalidProduct", {
          defaultMessage: "This product is not configured for parametric pricing."
        })
      );
      return () => {
        active = false;
      };
    }
    setLoadingConfig(true);
    setErrorMessage(null);
    setQuote(null);

    (async () => {
      try {
        const data = await StorefrontApi.getProductParametricConfig(numericId);
        if (!active) {
          return;
        }
        setConfig(data);
        setForm(createDefaultForm(data));
      } catch (error) {
        if (!active) {
          return;
        }
        setConfig(null);
        setForm(null);
        if (isApiError(error) && error.status === 404) {
          setErrorMessage(
            t("product.parametric.error.invalidProduct", {
              defaultMessage: "This product is not configured for parametric pricing."
            })
          );
        } else {
          console.warn("[storefront:parametric] failed to load config", error);
          setErrorMessage(
            t("product.parametric.error.configLoad", {
              defaultMessage: "Unable to load parametric configuration."
            })
          );
        }
      } finally {
        if (active) {
          setLoadingConfig(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [product.id, t]);

  const selectors = config?.selectors ?? null;
  const currentSizeLimits = useMemo(() => {
    if (!config || !form?.serie) {
      return null;
    }
    return config.compatibility.sizeLimits?.[form.serie] ?? null;
  }, [config, form?.serie]);

  const widthValues = useMemo(() => {
    if (!selectors) {
      return [];
    }
    return selectors.widths.filter((value) => {
      if (typeof currentSizeLimits?.minWidthMm === "number" && value < currentSizeLimits.minWidthMm) return false;
      if (typeof currentSizeLimits?.maxWidthMm === "number" && value > currentSizeLimits.maxWidthMm) return false;
      return true;
    });
  }, [currentSizeLimits?.maxWidthMm, currentSizeLimits?.minWidthMm, selectors]);

  const heightValues = useMemo(() => {
    if (!selectors) {
      return [];
    }
    return selectors.heights.filter((value) => {
      if (typeof currentSizeLimits?.minHeightMm === "number" && value < currentSizeLimits.minHeightMm) return false;
      if (typeof currentSizeLimits?.maxHeightMm === "number" && value > currentSizeLimits.maxHeightMm) return false;
      return true;
    });
  }, [currentSizeLimits?.maxHeightMm, currentSizeLimits?.minHeightMm, selectors]);

  const allowedGlassValues = useMemo(() => {
    if (!selectors) {
      return [];
    }
    const allowed = form?.serie ? config?.compatibility.glassBySeries?.[form.serie] : undefined;
    return selectors.glass.filter((value) => !allowed || allowed.length === 0 || allowed.includes(value));
  }, [config?.compatibility.glassBySeries, form?.serie, selectors]);

  const monoblockEnabledForSeries = useMemo(() => {
    if (!selectors?.hasMonoblockOption) {
      return false;
    }
    if (!form?.serie) {
      return selectors.hasMonoblockOption;
    }
    const flag = config?.compatibility.monoblockBySeries?.[form.serie];
    return flag !== false;
  }, [config?.compatibility.monoblockBySeries, form?.serie, selectors]);

  useEffect(() => {
    if (!selectors || !form) {
      return;
    }

    const next: Partial<ParametricFormState> = {};
    const ensureValue = (current: string, values: string[], fallback = "") => {
      if (!values.length) {
        return current;
      }
      if (values.includes(current)) {
        return current;
      }
      return values[0] ?? fallback;
    };

    const normalizedFamilies = selectors.families.filter(Boolean);
    const normalizedSeries = selectors.series.filter(Boolean);
    const normalizedMaterials = selectors.materials.filter(Boolean);
    const normalizedColors = selectors.colors.filter(Boolean);
    const normalizedShutterMaterials = selectors.shutterMaterials.filter(Boolean);

    const familyId = ensureValue(form.familyId, normalizedFamilies);
    const serie = ensureValue(form.serie, normalizedSeries);
    const material = ensureValue(form.material, normalizedMaterials, "ALUMINIO");
    const color = ensureValue(form.color, normalizedColors);
    const vidrio = ensureValue(form.vidrio, allowedGlassValues);
    const widthMm = widthValues.length
      ? ensureValue(form.widthMm, widthValues.map((value) => String(value)), form.widthMm)
      : form.widthMm;
    const heightMm = heightValues.length
      ? ensureValue(form.heightMm, heightValues.map((value) => String(value)), form.heightMm)
      : form.heightMm;
    const shutterMaterial = monoblockEnabledForSeries
      ? ensureValue(form.shutterMaterial, normalizedShutterMaterials)
      : "";
    const hasMosquitero = selectors.hasMosquiteroOption ? form.hasMosquitero : false;
    const hasShutterMonoblock = monoblockEnabledForSeries ? form.hasShutterMonoblock : false;

    if (familyId !== form.familyId) next.familyId = familyId;
    if (serie !== form.serie) next.serie = serie;
    if (material !== form.material) next.material = material;
    if (color !== form.color) next.color = color;
    if (vidrio !== form.vidrio) next.vidrio = vidrio;
    if (widthMm !== form.widthMm) next.widthMm = widthMm;
    if (heightMm !== form.heightMm) next.heightMm = heightMm;
    if (shutterMaterial !== form.shutterMaterial) next.shutterMaterial = shutterMaterial;
    if (hasMosquitero !== form.hasMosquitero) next.hasMosquitero = hasMosquitero;
    if (hasShutterMonoblock !== form.hasShutterMonoblock) next.hasShutterMonoblock = hasShutterMonoblock;

    if (Object.keys(next).length > 0) {
      setForm((prev) => (prev ? { ...prev, ...next } : prev));
    }
  }, [allowedGlassValues, form, heightValues, monoblockEnabledForSeries, selectors, widthValues]);

  const familyOptions = useMemo(() => toStringOptions(selectors?.families ?? []), [selectors?.families]);
  const seriesOptions = useMemo(() => toStringOptions(selectors?.series ?? []), [selectors?.series]);
  const materialOptions = useMemo(() => toStringOptions(selectors?.materials ?? []), [selectors?.materials]);
  const colorOptions = useMemo(() => toStringOptions(selectors?.colors ?? []), [selectors?.colors]);
  const glassOptions = useMemo(() => toStringOptions(allowedGlassValues), [allowedGlassValues]);
  const shutterMaterialOptions = useMemo(
    () => toStringOptions(selectors?.shutterMaterials ?? []),
    [selectors?.shutterMaterials],
  );
  const widthOptions = useMemo(() => toNumberOptions(widthValues), [widthValues]);
  const heightOptions = useMemo(() => toNumberOptions(heightValues), [heightValues]);

  const selectedFamilyOption = useMemo(
    () => familyOptions.find((option) => option.value === form?.familyId) ?? null,
    [familyOptions, form?.familyId],
  );
  const selectedSerieOption = useMemo(
    () => seriesOptions.find((option) => option.value === form?.serie) ?? null,
    [form?.serie, seriesOptions],
  );
  const selectedMaterialOption = useMemo(
    () => materialOptions.find((option) => option.value === form?.material) ?? null,
    [form?.material, materialOptions],
  );
  const selectedColorOption = useMemo(
    () => colorOptions.find((option) => option.value === form?.color) ?? null,
    [colorOptions, form?.color],
  );
  const selectedGlassOption = useMemo(
    () => glassOptions.find((option) => option.value === form?.vidrio) ?? null,
    [form?.vidrio, glassOptions],
  );
  const selectedWidthOption = useMemo(
    () => widthOptions.find((option) => option.value === form?.widthMm) ?? null,
    [form?.widthMm, widthOptions],
  );
  const selectedHeightOption = useMemo(
    () => heightOptions.find((option) => option.value === form?.heightMm) ?? null,
    [form?.heightMm, heightOptions],
  );
  const selectedShutterMaterialOption = useMemo(
    () => shutterMaterialOptions.find((option) => option.value === form?.shutterMaterial) ?? null,
    [form?.shutterMaterial, shutterMaterialOptions],
  );

  const handleSelectFieldChange = useCallback(
    (field: keyof Pick<ParametricFormState, "familyId" | "serie" | "material" | "color" | "vidrio" | "widthMm" | "heightMm" | "shutterMaterial">) =>
      (input: unknown) => {
        const value = readOptionValue(input);
        setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
      },
    [],
  );

  const handleToggleChange = useCallback(
    (field: "hasMosquitero" | "hasShutterMonoblock") => (checked: boolean) => {
      setForm((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          [field]: checked,
        };
      });
    },
    [],
  );

  const handleDimensionChange = useCallback(
    (field: "widthMm" | "heightMm") => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitizeNumber(event.target.value);
      setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  const handleQuote = useCallback(async () => {
    setQuoting(true);
    setErrorMessage(null);
    setQuote(null);

    const numericId = Number(product.id);
    if (!Number.isFinite(numericId) || numericId <= 0 || !form) {
      setQuoting(false);
      setErrorMessage(
        t("product.parametric.error.invalidProduct", {
          defaultMessage: "This product is not configured for parametric pricing."
        })
      );
      return;
    }

    const payload = buildQuotePayload(form);
    if (
      !payload.serie ||
      !payload.material ||
      !payload.color ||
      !payload.vidrio ||
      payload.widthMm <= 0 ||
      payload.heightMm <= 0
    ) {
      setQuoting(false);
      setErrorMessage(
        t("errors.validation", {
          defaultMessage: "Review the information provided."
        })
      );
      return;
    }

    try {
      const result = await StorefrontApi.quoteParametricProduct(numericId, payload);
      setQuote(result);
      if (!result.available) {
        setErrorMessage(
          t("product.parametric.error.unavailable", {
            defaultMessage: "No pricing is available for the selected configuration."
          })
        );
      }
    } catch (error) {
      console.error("[storefront:parametric] quote failed", error);
      setErrorMessage(
        t("product.parametric.error.quoteFailed", {
          defaultMessage: "We couldn't calculate the price. Please try again."
        })
      );
    } finally {
      setQuoting(false);
    }
  }, [form, product.id, t]);

  const handleAddToCart = useCallback(() => {
    if (!quote?.available || typeof quote.price !== "number" || !form) {
      return;
    }

    const configurationPayload = buildQuotePayload(form);
    const lineId = buildParametricLineId(product.id, configurationPayload);
    const money = normalizeMoney({
      amount: quote.price,
      currency: quote.currency ?? product.currency ?? baseCurrency,
    });
    const summaryLabel = `${configurationPayload.serie} ${configurationPayload.widthMm}x${configurationPayload.heightMm} mm`;

    const snapshot: CartProductSnapshot = {
      id: lineId,
      productId: product.id,
      mode: product.mode ?? "parametric",
      variantId: undefined,
      variantKey: undefined,
      variantLabel: summaryLabel,
      slug: product.slug,
      name: product.title,
      price: money,
      salePrice: null,
      inventoryStatus: normalizeInventoryStatus(product.status),
      thumbnail: gallery.length
        ? {
            id: lineId,
            url: gallery[Math.min(selectedImage, gallery.length - 1)],
          }
        : undefined,
      configuration: {
        ...configurationPayload,
        currency: quote.currency ?? product.currency ?? baseCurrency,
        referenceDate: quote.referenceDate ?? null,
        source: quote.source ?? null,
        matrixRowId: quote.matrixRowId ?? null,
        specifications: quote.specifications ?? null,
      },
    };

    addItemSnapshot(snapshot, 1);
  }, [addItemSnapshot, baseCurrency, form, gallery, product, quote, selectedImage]);

  const existingQuantity = useMemo(() => {
    if (!form) {
      return 0;
    }
    const lineId = buildParametricLineId(product.id, buildQuotePayload(form));
    const entry = items.find((item) => item.product.id === lineId);
    return entry?.quantity ?? 0;
  }, [form, product.id, items]);

  const unitsLabel = useMemo(() => {
    if (existingQuantity === 1) {
      return t("product.parametric.units.single", { defaultMessage: "1 unit" });
    }
    return t("product.parametric.units.plural", {
      defaultMessage: "{count} units",
      values: { count: existingQuantity }
    });
  }, [existingQuantity, t]);

  const inCartNotice = useMemo(() => {
    if (existingQuantity <= 0) {
      return "";
    }
    return t("product.parametric.notice.inCart", {
      defaultMessage: "You already have {units} of this configuration in the cart.",
      values: { units: unitsLabel }
    });
  }, [existingQuantity, t, unitsLabel]);

  const minimumPriceLabel = useMemo(() => {
    if (!config?.stats.minimumPrice) {
      return null;
    }
    return formatAmount(config.stats.minimumPrice, config.stats.currency ?? product.currency ?? baseCurrency);
  }, [baseCurrency, config?.stats.currency, config?.stats.minimumPrice, formatAmount, product.currency]);

  const quotePriceLabel =
    quote?.available && typeof quote.price === "number"
      ? formatAmount(quote.price, quote.currency ?? product.currency ?? baseCurrency)
      : null;

  if (!form) {
    return (
      <Box overflow="hidden">
        <Paragraph color={errorMessage ? "error.main" : "text.muted"}>
          {errorMessage ??
            t("product.parametric.loading", {
              defaultMessage: "Loading parametric configuration…"
            })}
        </Paragraph>
      </Box>
    );
  }

  return (
    <Box overflow="hidden">
      <Grid container justifyContent="center" alignItems="flex-start" spacing={16}>
        <Grid item md={6} xs={12} alignItems="center">
          <div>
            <FlexBox mb="50px" overflow="hidden" borderRadius={16} justifyContent="center">
              {hasGallery ? (
                <Image
                  width={300}
                  height={300}
                  src={gallery[Math.min(selectedImage, gallery.length - 1)]}
                  alt={product.title}
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
                {gallery.map((url, index) => (
                  <Box
                    key={url}
                    size={70}
                    bg="white"
                    minWidth={70}
                    display="flex"
                    cursor="pointer"
                    border="1px solid"
                    borderRadius="10px"
                    alignItems="center"
                    justifyContent="center"
                    ml={index === 0 ? "auto" : ""}
                    mr={index === gallery.length - 1 ? "auto" : "10px"}
                    borderColor={selectedImage === index ? "primary.main" : "gray.400"}
                    onClick={() => onSelectImage(index)}
                  >
                    <Avatar src={url} borderRadius="10px" size={65} />
                  </Box>
                ))}
              </FlexBox>
            ) : null}
          </div>
        </Grid>

        <Grid item md={6} xs={12} alignItems="center">
          <H1 mb="0.75rem">{product.title}</H1>

          {product.shortDescription ? (
            <Paragraph color="text.muted" mb="1rem">
              {product.shortDescription}
            </Paragraph>
          ) : null}

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>{t("product.labels.brand", { defaultMessage: "Brand:" })}</SemiSpan>
            <SemiSpan ml="8px">
              {product.brand ?? t("product.brand.default", { defaultMessage: "Store brand" })}
            </SemiSpan>
          </FlexBox>

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>{t("product.labels.rated", { defaultMessage: "Rated:" })}</SemiSpan>
            <Box ml="8px" mr="8px">
              <Rating color="warn" value={product.rating ?? 4} outof={5} />
            </Box>
            <SemiSpan>({product.ratingCount ?? 0})</SemiSpan>
          </FlexBox>

          <Box mb="24px">
            {quotePriceLabel ? (
              <H2 color="primary.main" mb="4px" lineHeight="1">
                {quotePriceLabel}
              </H2>
            ) : minimumPriceLabel ? (
              <>
                <H2 color="primary.main" mb="4px" lineHeight="1">
                  {minimumPriceLabel}
                </H2>
                <SemiSpan color="inherit" display="block" mt="0.35rem">
                  {t("product.parametric.minimumPrice", {
                    defaultMessage: "Base price from the current matrix"
                  })}
                </SemiSpan>
              </>
            ) : (
              <Paragraph color="text.muted">
                {loadingConfig
                  ? t("product.parametric.loading", {
                      defaultMessage: "Loading parametric configuration…"
                    })
                  : t("product.parametric.instructions", {
                      defaultMessage: "Select the exact dimensions and components to calculate the price."
                    })}
              </Paragraph>
            )}
          </Box>

          <Box mb="24px" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label={t("product.parametric.fields.family", {
                defaultMessage: "Family"
              })}
              options={familyOptions}
              value={selectedFamilyOption}
              onChange={handleSelectFieldChange("familyId")}
              placeholder={t("product.parametric.fields.family", {
                defaultMessage: "Family"
              })}
            />
            <Select
              label={t("product.parametric.fields.series", {
                defaultMessage: "Series"
              })}
              options={seriesOptions}
              value={selectedSerieOption}
              onChange={handleSelectFieldChange("serie")}
              placeholder={t("product.parametric.fields.series", {
                defaultMessage: "Series"
              })}
            />
            <Select
              label={t("product.parametric.fields.material", {
                defaultMessage: "Material"
              })}
              options={materialOptions}
              value={selectedMaterialOption}
              onChange={handleSelectFieldChange("material")}
              placeholder={t("product.parametric.fields.material", {
                defaultMessage: "Material"
              })}
            />
            <Select
              label={t("product.parametric.fields.color", {
                defaultMessage: "Color"
              })}
              options={colorOptions}
              value={selectedColorOption}
              onChange={handleSelectFieldChange("color")}
              placeholder={t("product.parametric.fields.color", {
                defaultMessage: "Color"
              })}
            />
            <Select
              label={t("product.parametric.fields.glass", {
                defaultMessage: "Glass"
              })}
              options={glassOptions}
              value={selectedGlassOption}
              onChange={handleSelectFieldChange("vidrio")}
              placeholder={t("product.parametric.fields.glass", {
                defaultMessage: "Glass"
              })}
            />

            {widthOptions.length > 0 ? (
              <Select
                label={t("product.parametric.fields.width", {
                  defaultMessage: "Width (mm)"
                })}
                options={widthOptions}
                value={selectedWidthOption}
                onChange={handleSelectFieldChange("widthMm")}
                placeholder={t("product.parametric.fields.width", {
                  defaultMessage: "Width (mm)"
                })}
              />
            ) : (
              <TextField
                label={t("product.parametric.fields.width", {
                  defaultMessage: "Width (mm)"
                })}
                inputMode="numeric"
                value={form.widthMm}
                onChange={handleDimensionChange("widthMm")}
              />
            )}

            {heightOptions.length > 0 ? (
              <Select
                label={t("product.parametric.fields.height", {
                  defaultMessage: "Height (mm)"
                })}
                options={heightOptions}
                value={selectedHeightOption}
                onChange={handleSelectFieldChange("heightMm")}
                placeholder={t("product.parametric.fields.height", {
                  defaultMessage: "Height (mm)"
                })}
              />
            ) : (
              <TextField
                label={t("product.parametric.fields.height", {
                  defaultMessage: "Height (mm)"
                })}
                inputMode="numeric"
                value={form.heightMm}
                onChange={handleDimensionChange("heightMm")}
              />
            )}
          </Box>

          {currentSizeLimits ? (
            <Paragraph color="text.muted" mb="1rem">
              {t("product.parametric.sizeLimits", {
                defaultMessage:
                  "Allowed range for this series: width {minWidth}-{maxWidth} mm, height {minHeight}-{maxHeight} mm.",
                values: {
                  minWidth: currentSizeLimits.minWidthMm ?? "-",
                  maxWidth: currentSizeLimits.maxWidthMm ?? "-",
                  minHeight: currentSizeLimits.minHeightMm ?? "-",
                  maxHeight: currentSizeLimits.maxHeightMm ?? "-",
                }
              })}
            </Paragraph>
          ) : null}

          <Box mb="24px" className="border rounded-md p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("product.parametric.fields.mosquito", {
                  defaultMessage: "Mosquito net"
                })}
              </span>
              <Switcher
                checked={form.hasMosquitero}
                onChange={handleToggleChange("hasMosquitero")}
                disabled={!Boolean(selectors?.hasMosquiteroOption)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("product.parametric.fields.monoblock", {
                  defaultMessage: "Monoblock"
                })}
              </span>
              <Switcher
                checked={form.hasShutterMonoblock}
                onChange={handleToggleChange("hasShutterMonoblock")}
                disabled={!monoblockEnabledForSeries}
              />
            </div>

            {form.hasShutterMonoblock ? (
              <Select
                label={t("product.parametric.fields.shutterMaterial", {
                  defaultMessage: "Shutter material"
                })}
                options={shutterMaterialOptions}
                value={selectedShutterMaterialOption}
                onChange={handleSelectFieldChange("shutterMaterial")}
                placeholder={t("product.parametric.fields.shutterMaterial", {
                  defaultMessage: "Shutter material"
                })}
              />
            ) : null}
          </Box>

          <FlexBox alignItems="center" mb="24px" style={{ gap: "0.75rem" }}>
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={handleQuote}
              disabled={quoting || loadingConfig}
            >
              {quoting
                ? t("product.parametric.buttons.quotePending", {
                    defaultMessage: "Calculating..."
                  })
                : t("product.parametric.buttons.quote", {
                    defaultMessage: "Calculate price"
                  })}
            </Button>
            <Button
              size="small"
              color="primary"
              variant="outlined"
              disabled={!quote?.available}
              onClick={handleAddToCart}
            >
              {t("product.parametric.buttons.addToCart", {
                defaultMessage: "Add to cart"
              })}
            </Button>
          </FlexBox>

          {existingQuantity > 0 ? (
            <SemiSpan color="text.muted" display="block" mb="1rem">
              {inCartNotice}
            </SemiSpan>
          ) : null}

          {quote?.available ? (
            <Box mb="1.5rem" className="border rounded-md p-3 text-sm">
              <Paragraph fontWeight="600" mb="0.5rem">
                {t("product.parametric.breakdown.title", {
                  defaultMessage: "Selected configuration"
                })}
              </Paragraph>
              <ul>
                <li>
                  {t("product.parametric.fields.family", { defaultMessage: "Family" })}:{" "}
                  {formatSelectorValue(quote.requested.familyId ?? null)}
                </li>
                <li>
                  {t("product.parametric.fields.series", { defaultMessage: "Series" })}: {quote.requested.serie}
                </li>
                <li>
                  {t("product.parametric.fields.material", { defaultMessage: "Material" })}: {quote.requested.material}
                </li>
                <li>
                  {t("product.parametric.fields.color", { defaultMessage: "Color" })}: {quote.requested.color}
                </li>
                <li>
                  {t("product.parametric.fields.glass", { defaultMessage: "Glass" })}: {quote.requested.vidrio}
                </li>
                <li>
                  {t("product.parametric.fields.width", { defaultMessage: "Width (mm)" })}: {quote.requested.widthMm}
                </li>
                <li>
                  {t("product.parametric.fields.height", { defaultMessage: "Height (mm)" })}: {quote.requested.heightMm}
                </li>
                <li>
                  {t("product.parametric.fields.mosquito", { defaultMessage: "Mosquito net" })}:{" "}
                  {quote.requested.hasMosquitero
                    ? t("common.yes", { defaultMessage: "Yes" })
                    : t("common.no", { defaultMessage: "No" })}
                </li>
                <li>
                  {t("product.parametric.fields.monoblock", { defaultMessage: "Monoblock" })}:{" "}
                  {quote.requested.hasShutterMonoblock
                    ? t("common.yes", { defaultMessage: "Yes" })
                    : t("common.no", { defaultMessage: "No" })}
                </li>
                {quote.requested.hasShutterMonoblock ? (
                  <li>
                    {t("product.parametric.fields.shutterMaterial", {
                      defaultMessage: "Shutter material"
                    })}: {quote.requested.shutterMaterial}
                  </li>
                ) : null}
                {quote.source ? (
                  <li>
                    {t("product.parametric.source", { defaultMessage: "Source" })}: {quote.source}
                  </li>
                ) : null}
                {quote.referenceDate ? (
                  <li>
                    {t("product.parametric.referenceDate", { defaultMessage: "Reference date" })}:{" "}
                    {new Date(quote.referenceDate).toLocaleDateString()}
                  </li>
                ) : null}
              </ul>
              {quote.specifications ? (
                <Paragraph mt="0.75rem" style={{ whiteSpace: "pre-line" }}>
                  {quote.specifications}
                </Paragraph>
              ) : null}
            </Box>
          ) : null}

          {errorMessage ? (
            <Paragraph color="error.main" mt="0.5rem">
              {errorMessage}
            </Paragraph>
          ) : null}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ParametricConfigurator;
