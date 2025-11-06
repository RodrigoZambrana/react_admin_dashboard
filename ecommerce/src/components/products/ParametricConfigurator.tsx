import { useCallback, useEffect, useMemo, useState } from "react";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Box from "@component/Box";
import Image from "@component/Image";
import Avatar from "@component/avatar";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { Button } from "@component/buttons";
import { H1, H2, H3, H6, Paragraph, SemiSpan } from "@component/Typography";
import Rating from "@component/rating";
import Switcher from "@component/switch";
import Select from "@component/Select";
import TextField from "@component/text-field";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { normalizeMoney } from "@/lib/utils/format";
import { StorefrontApi } from "@/lib/api/storefront";
import useCart from "@hook/useCart";
import type Product from "@models/product.model";
import type { CartProductSnapshot } from "@/state/cart-context";
import { useTranslation } from "@/state/i18n-context";
import type { InventoryStatus } from "@/types/storefront";

const DEFAULT_OPTIONS = {
  series: ["20", "25", "30", "GALA", "PROBBA", "SUMMA"],
  colors: ["NATURAL", "WHITE", "BLACK", "BROWN", "ANOLOC"],
  glass: ["3MM", "4MM", "5MM", "6MM", "DVH"],
};

const DEFAULT_FORM = {
  width: "1.00",
  height: "1.00",
  series: "GALA",
  color: "NATURAL",
  glass: "4MM",
  mosquitoNet: false,
  monoblockEnabled: false,
  monoblockMaterial: "PVC",
  monoblockColor: "WHITE",
};

const sanitizeNumber = (value: string) => value.replace(/[^0-9.,]/g, "");

const toNumber = (value: string) => {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

const buildParametricLineId = (
  productId: string | number,
  config: {
    width: number;
    height: number;
    series: string;
    color: string;
    glass: string;
    mosquitoNet: boolean;
    monoblock: { enabled: boolean; material?: string | null; color?: string | null };
  }
) => {
  const widthKey = Math.round(config.width * 1000);
  const heightKey = Math.round(config.height * 1000);
  const seriesKey = sanitizeCode(config.series);
  const colorKey = sanitizeCode(config.color);
  const glassKey = sanitizeCode(config.glass);
  const mosquitoKey = config.mosquitoNet ? "MSQ1" : "MSQ0";
  const monoblockKey = config.monoblock.enabled
    ? `MB-${sanitizeCode(config.monoblock.material ?? "UNK")}-${sanitizeCode(
        config.monoblock.color ?? "UNK"
      )}`
    : "MB-0";
  return `${productId}:PARAM:${widthKey}x${heightKey}:${seriesKey}:${colorKey}:${glassKey}:${mosquitoKey}:${monoblockKey}`;
};

const extractOptions = (config: Record<string, any> | null | undefined) => {
  if (!config || typeof config !== "object") {
    return DEFAULT_OPTIONS;
  }
  return {
    series: Array.isArray(config?.inputs?.series?.options)
      ? config.inputs.series.options
      : DEFAULT_OPTIONS.series,
    colors: Array.isArray(config?.inputs?.color?.options)
      ? config.inputs.color.options
      : DEFAULT_OPTIONS.colors,
    glass: Array.isArray(config?.inputs?.glass?.options)
      ? config.inputs.glass.options
      : DEFAULT_OPTIONS.glass,
  };
};

const buildConfigurationPayload = (
  form: typeof DEFAULT_FORM
): {
  width: number;
  height: number;
  series: string;
  color: string;
  glass: string;
  mosquitoNet: boolean;
  monoblock: { enabled: boolean; material?: string; color?: string };
} => ({
  width: toNumber(form.width),
  height: toNumber(form.height),
  series: form.series,
  color: form.color,
  glass: form.glass,
  mosquitoNet: form.mosquitoNet,
  monoblock: form.monoblockEnabled
    ? {
        enabled: true,
        material: form.monoblockMaterial,
        color: form.monoblockColor,
      }
    : { enabled: false },
});

type ParametricProductInfo = Pick<
  Product,
  "id" | "slug" | "title" | "shortDescription" | "brand" | "rating" | "ratingCount" | "currency" | "status"
>;

type ParametricConfiguratorProps = {
  product: ParametricProductInfo;
  gallery: string[];
  hasGallery: boolean;
  selectedImage: number;
  onSelectImage: (index: number) => void;
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
  const [form, setForm] = useState(DEFAULT_FORM);
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [quote, setQuote] = useState<null | {
    total: number;
    currency: string;
    breakdown: Record<string, number>;
    referenceDate: string;
    dataVersion: string;
  }>(null);
  const [quoting, setQuoting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const options = useMemo(() => extractOptions(config), [config]);

  useEffect(() => {
    let active = true;
    const numericId = Number(product.id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setConfig(null);
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
    (async () => {
      try {
        const data = await StorefrontApi.getProductParametricConfig(numericId);
        if (active) {
          setConfig(data);
        }
      } catch (error) {
        console.warn("[storefront:parametric] failed to load config", error);
        if (active) {
          setConfig(null);
          setErrorMessage((prev) =>
            prev ??
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

  const handleFieldChange = useCallback(
    (field: keyof typeof DEFAULT_FORM) => (input: unknown) => {
      let value: string | boolean;
      if (typeof input === "boolean") {
        value = input;
      } else if (typeof input === "string") {
        value = input;
      } else if (input && typeof input === "object" && "value" in input) {
        const optionValue = (input as { value?: unknown }).value;
        if (typeof optionValue === "boolean" || typeof optionValue === "string") {
          value = optionValue;
        } else if (optionValue == null) {
          value = "";
        } else {
          value = String(optionValue);
        }
      } else if (typeof input === "number") {
        value = String(input);
      } else {
        value = "";
      }

      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleQuote = useCallback(async () => {
    setQuoting(true);
    setErrorMessage(null);
    setQuote(null);
    const numericId = Number(product.id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setQuoting(false);
      setErrorMessage(
        t("product.parametric.error.invalidProduct", {
          defaultMessage: "This product is not configured for parametric pricing."
        })
      );
      return;
    }
    try {
      const payload = buildConfigurationPayload(form);
      const result = await StorefrontApi.quoteParametricProduct(numericId, payload);
      setQuote({
        total: result.total,
        currency: result.currency ?? product.currency ?? baseCurrency,
        breakdown: result.breakdown,
        referenceDate: result.referenceDate,
        dataVersion: result.dataVersion,
      });
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
  }, [form, product.id, product.currency, baseCurrency, t]);

  const handleAddToCart = useCallback(() => {
    if (!quote) {
      return;
    }
    const configurationPayload = buildConfigurationPayload(form);
    const lineId = buildParametricLineId(product.id, configurationPayload);
    const money = normalizeMoney({
      amount: quote.total,
      currency: quote.currency ?? product.currency ?? baseCurrency,
    });
    const summaryLabel = `Serie ${configurationPayload.series} ${configurationPayload.width.toFixed(2)}x${configurationPayload.height.toFixed(2)}`;

    const snapshot: CartProductSnapshot = {
      id: lineId,
      productId: product.id,
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
        referenceDate: quote.referenceDate,
        dataVersion: quote.dataVersion,
        breakdown: quote.breakdown,
      },
    };

    addItemSnapshot(snapshot, 1);
  }, [addItemSnapshot, baseCurrency, form, gallery, product, quote, selectedImage]);

  const existingQuantity = useMemo(() => {
    const configurationPayload = buildConfigurationPayload(form);
    const lineId = buildParametricLineId(product.id, configurationPayload);
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

  const { width, height, series, color, glass, mosquitoNet, monoblockEnabled, monoblockMaterial, monoblockColor } = form;

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
                    onClick={() => onSelectImage(ind)}
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
            <SemiSpan>Brand:</SemiSpan>
            <H6 ml="8px">{product.brand ?? "Store brand"}</H6>
          </FlexBox>

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>Rated:</SemiSpan>
            <Box ml="8px" mr="8px">
              <Rating color="warn" value={product.rating ?? 4} outof={5} />
            </Box>
            <H6>({product.ratingCount ?? 0})</H6>
          </FlexBox>

          <Box mb="24px">
            {quote ? (
              <>
                <H2 color="primary.main" mb="4px" lineHeight="1">
                  {formatAmount(quote.total, quote.currency ?? baseCurrency)}
                </H2>
                <SemiSpan color="inherit" display="block" mt="0.35rem">
                  {t("product.parametric.quoteVersion", {
                    defaultMessage: "Version {version}",
                    values: { version: quote.dataVersion.split("#")[0] }
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
                      defaultMessage: "Enter the dimensions and components to obtain an estimated price."
                    })}
              </Paragraph>
            )}
          </Box>

          <Box mb="24px" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label={t("product.parametric.fields.width", {
                defaultMessage: "Width (m)"
              })}
              value={width}
              onChange={(event) => handleFieldChange("width")(sanitizeNumber(event.target.value))}
            />
            <TextField
              label={t("product.parametric.fields.height", {
                defaultMessage: "Height (m)"
              })}
              value={height}
              onChange={(event) => handleFieldChange("height")(sanitizeNumber(event.target.value))}
            />
            <Select
              options={options.series.map((value) => ({ value, label: value }))}
              value={series}
              onChange={(value) => handleFieldChange("series")(value)}
              placeholder={t("product.parametric.fields.series", {
                defaultMessage: "Series"
              })}
            />
            <Select
              options={options.colors.map((value) => ({ value, label: value }))}
              value={color}
              onChange={(value) => handleFieldChange("color")(value)}
              placeholder={t("product.parametric.fields.color", {
                defaultMessage: "Color"
              })}
            />
            <Select
              options={options.glass.map((value) => ({ value, label: value }))}
              value={glass}
              onChange={(value) => handleFieldChange("glass")(value)}
              placeholder={t("product.parametric.fields.glass", {
                defaultMessage: "Glass"
              })}
            />
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <span className="text-sm font-medium">
                {t("product.parametric.fields.mosquito", {
                  defaultMessage: "Mosquito net"
                })}
              </span>
              <Switcher
                checked={mosquitoNet}
                onChange={(checked) => handleFieldChange("mosquitoNet")(checked)}
              />
            </div>
          </Box>

          <Box mb="24px" className="border rounded-md p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("product.parametric.fields.monoblock", {
                  defaultMessage: "Monoblock"
                })}
              </span>
              <Switcher
                checked={monoblockEnabled}
                onChange={(checked) => handleFieldChange("monoblockEnabled")(checked)}
              />
            </div>
            {monoblockEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  options={[
                    { value: "PVC", label: "PVC" },
                    { value: "ALUMINUM", label: "ALUMINUM" },
                  ]}
                  value={monoblockMaterial}
                  onChange={(value) => handleFieldChange("monoblockMaterial")(value)}
                  placeholder={t("product.parametric.fields.monoblockMaterial", {
                    defaultMessage: "Material"
                  })}
                />
                <Select
                  options={["WHITE", "NATURAL", "BLACK", "BROWN"].map((value) => ({ value, label: value }))}
                  value={monoblockColor}
                  onChange={(value) => handleFieldChange("monoblockColor")(value)}
                  placeholder={t("product.parametric.fields.monoblockColor", {
                    defaultMessage: "Color"
                  })}
                />
              </div>
            )}
          </Box>

          <FlexBox alignItems="center" mb="24px" style={{ gap: "0.75rem" }}>
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={handleQuote}
              disabled={quoting}
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
              disabled={!quote}
              onClick={handleAddToCart}
            >
              {t("product.parametric.buttons.addToCart", {
                defaultMessage: "Add to cart"
              })}
            </Button>
          </FlexBox>

          {existingQuantity > 0 && (
            <SemiSpan color="text.muted" display="block" mb="1rem">
              {inCartNotice}
            </SemiSpan>
          )}

          {quote ? (
            <Box mb="1.5rem" className="border rounded-md p-3 text-sm">
              <Paragraph fontWeight="600" mb="0.5rem">
                {t("product.parametric.breakdown.title", {
                  defaultMessage: "Calculation detail"
                })}
              </Paragraph>
              <ul>
                <li>
                  {t("product.parametric.breakdown.base", { defaultMessage: "Base" })}:{" "}
                  {formatAmount(quote.breakdown.base ?? 0, quote.currency ?? baseCurrency)}
                </li>
                <li>
                  {t("product.parametric.breakdown.color", { defaultMessage: "Color" })}:{" "}
                  {formatAmount(quote.breakdown.color ?? 0, quote.currency ?? baseCurrency)}
                </li>
                <li>
                  {t("product.parametric.breakdown.glass", { defaultMessage: "Glass" })}:{" "}
                  {formatAmount(quote.breakdown.glass ?? 0, quote.currency ?? baseCurrency)}
                </li>
                <li>
                  {t("product.parametric.breakdown.monoblock", { defaultMessage: "Monoblock" })}:{" "}
                  {formatAmount(quote.breakdown.monoblock ?? 0, quote.currency ?? baseCurrency)}
                </li>
                <li>
                  {t("product.parametric.breakdown.mosquito", { defaultMessage: "Mosquito net" })}:{" "}
                  {formatAmount(quote.breakdown.mosquitoNet ?? 0, quote.currency ?? baseCurrency)}
                </li>
              </ul>
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
