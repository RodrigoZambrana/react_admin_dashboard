"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { space, type SpaceProps } from "styled-system";

import Box from "@component/Box";
import Container from "@component/Container";
import FlexBox from "@component/FlexBox";
import Grid from "@component/grid/Grid";
import Typography, { H1, H3, Paragraph } from "@component/Typography";
import Select from "@component/Select";
import TextField from "@component/text-field";
import { Button, IconButton } from "@component/buttons";
import { Card1 } from "@component/Card1";
import LazyImage from "@component/LazyImage";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";

import { isValidProp } from "@utils/utils";

import { useStorefrontCart } from "@/state/cart-context";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { StorefrontApi } from "@/lib/api/storefront";
import { executeRecaptchaAction } from "@/utils/security/recaptcha";
import type {
  BudgetAddToCartResponse,
  BudgetCalculationResult,
  BudgetProductSummary,
} from "@/types/storefront";

type DraftItem = BudgetCalculationResult & {
  qty: number;
};

type Props = {
  title?: string;
  description?: string;
  initialProductId?: number | null;
  initialProductSlug?: string | null;
  initialWidth?: number;
  initialHeight?: number;
  initialCustomerName?: string;
  initialCustomerEmail?: string;
  initialCustomerPhone?: string;
  initialCustomerNotes?: string;
  compact?: boolean;
  tone?: "default" | "product";
  showCustomerFields?: boolean;
  submitLabel?: string;
  onEditCustomer?: () => void;
};

const resolveInitialProductId = (
  products: BudgetProductSummary[],
  initialProductId?: number | null,
  initialProductSlug?: string | null,
) => {
  if (initialProductId) {
    const byId = products.find((product) => product.id === initialProductId);
    if (byId) return byId.id;
  }
  if (initialProductSlug) {
    const bySlug = products.find((product) => product.slug === initialProductSlug);
    if (bySlug) return bySlug.id;
  }
  return products[0]?.id ?? "";
};

const buildCartLineId = (product: BudgetProductSummary, item: BudgetCalculationResult) =>
  `budget:${product.slug}:${item.width.toFixed(2)}x${item.height.toFixed(2)}:${item.currency ?? ""}`;

const parseDimension = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  return normalized.length ? Number(normalized) : Number.NaN;
};

const isValidDimension = (value: string) => {
  const parsed = parseDimension(value);
  return Number.isFinite(parsed) && parsed > 0;
};

const formatDimension = (value: string) => {
  const parsed = parseDimension(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDisplayedDimension = (value: string) => {
  const parsed = parseDimension(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTrimmed = (value: string) => value.trim();

const budgetDisclaimer =
  "Los presupuestos obtenidos están sujetos a rectificación y confirmación a través de cualquiera de nuestros medios de contacto oficiales.";

const buildShareMessage = (
  items: DraftItem[],
  activeCurrency: string,
  formatAmount: (amount: number, currency?: string) => string,
  customer: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  },
) => {
  const headerLines = [
    customer.name ? `Nombre: ${customer.name}` : "",
    customer.email ? `Email: ${customer.email}` : "",
    customer.phone ? `Teléfono: ${customer.phone}` : "",
    customer.notes ? `Notas: ${customer.notes}` : "",
  ].filter(Boolean);

  const itemLines = items.map((item) => {
    const sourceCurrency = item.currency ?? activeCurrency;
    return [
      `${item.qty} ${item.product?.name ?? `Producto ${item.productId}`}`,
      `Ancho: ${item.width.toFixed(2)} m`,
      `Alto: ${item.height.toFixed(2)} m`,
      `Total: ${formatAmount(item.totalPrice * item.qty, sourceCurrency)}`,
    ].join(" ");
  });

  return [
    ...headerLines,
    ...itemLines,
    `Subtotal: ${formatAmount(
      items.reduce((sum, item) => sum + item.totalPrice * item.qty, 0),
      items[0]?.currency ?? activeCurrency,
    )}`,
    budgetDisclaimer,
  ]
    .filter(Boolean)
    .join("\n");
};

const BudgetLineItemWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => isValidProp(prop),
})<SpaceProps>`
  display: flex;
  overflow: hidden;
  position: relative;
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.small};
  background-color: ${({ theme }) => theme.colors.body.paper};

  .product-details {
    padding: 20px;
  }

  .title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  @media only screen and (max-width: 425px) {
    flex-wrap: wrap;

    img {
      height: auto;
      min-width: 100%;
    }
  }

  ${space}
`;

type BudgetLineItemCardProps = SpaceProps & {
  item: DraftItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  lineTotalLabel: string;
  unitPriceLabel: string;
};

function BudgetLineItemCard({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  lineTotalLabel,
  unitPriceLabel,
  ...rest
}: BudgetLineItemCardProps) {
  const thumbnailSrc = item.product?.img;
  const hasImage = Boolean(thumbnailSrc);

  return (
    <BudgetLineItemWrapper {...rest}>
      {hasImage ? (
        <LazyImage alt={item.product?.name ?? "Producto"} width={140} height={140} src={thumbnailSrc!} />
      ) : (
        <NoImagePlaceholder width={140} height={140} />
      )}

      <FlexBox
        width="100%"
        minWidth="0px"
        flexDirection="column"
        className="product-details"
        justifyContent="space-between"
      >
        <FlexBox justifyContent="space-between" alignItems="flex-start">
          <Box minWidth="0">
            <Typography className="title" fontWeight="500" fontSize="18px" mb="0.35rem">
              {item.product?.name ?? `Producto ${item.productId}`}
            </Typography>
            <Typography color="text.muted" mb="0.35rem" fontSize="14px">
              Ancho: {item.width.toFixed(2)} m • Alto: {item.height.toFixed(2)} m
            </Typography>
            <Typography color="text.muted" fontSize="14px">
              {unitPriceLabel} x {item.qty}
            </Typography>
          </Box>

          <IconButton color="gray.600" padding="4px" ml="12px" onClick={onRemove}>
            <IconX size={18} />
          </IconButton>
        </FlexBox>

        <FlexBox justifyContent="space-between" alignItems="flex-end" mt="1rem">
          <Typography fontWeight={600} color="primary.main" fontSize="18px">
            = {lineTotalLabel}
          </Typography>

          <FlexBox alignItems="center" style={{ gap: "0.5rem" }}>
            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              borderColor="primary.light"
              disabled={item.qty === 1}
              onClick={onDecrease}
            >
              <IconMinus size={16} />
            </Button>

            <Typography mx="0.5rem" fontWeight="600" fontSize="15px">
              {item.qty}
            </Typography>

            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              borderColor="primary.light"
              onClick={onIncrease}
            >
              <IconPlus size={16} />
            </Button>
          </FlexBox>
        </FlexBox>
      </FlexBox>
    </BudgetLineItemWrapper>
  );
}

export default function BudgetCalculatorPanel({
  title = "Calculá el precio de tu cortina",
  description = "Ingresá las medidas y obtené el precio al instante.",
  initialProductId = null,
  initialProductSlug = null,
  initialWidth = 1,
  initialHeight = 1,
  initialCustomerName = "",
  initialCustomerEmail = "",
  initialCustomerPhone = "",
  initialCustomerNotes = "",
  compact = false,
  tone = "default",
  showCustomerFields = true,
  submitLabel = "Agregar todos al carrito",
  onEditCustomer,
}: Props) {
  void showCustomerFields;
  void initialCustomerName;
  void initialCustomerEmail;
  void initialCustomerPhone;
  void initialCustomerNotes;

  const { addItemSnapshot } = useStorefrontCart();
  const config = useStorefrontConfig();
  const { baseCurrency, currency: selectedCurrency, formatAmount } = useMoneyFormatter();
  const isProductTone = tone === "product";

  const [products, setProducts] = useState<BudgetProductSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [width, setWidth] = useState(initialWidth > 1 ? String(initialWidth) : "");
  const [height, setHeight] = useState(initialHeight > 1 ? String(initialHeight) : "");
  const [widthTouched, setWidthTouched] = useState(false);
  const [heightTouched, setHeightTouched] = useState(false);
  const [calculation, setCalculation] = useState<BudgetCalculationResult | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCalculation, setLoadingCalculation] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BudgetAddToCartResponse | null>(null);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [customerNotes] = useState(initialCustomerNotes);
  const [honeypot, setHoneypot] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const recaptchaSiteKey =
    config.integrations?.recaptcha?.enabled && config.integrations.recaptcha.siteKey
      ? config.integrations.recaptcha.siteKey
      : null;

  useEffect(() => {
    let active = true;
    setLoadingProducts(true);
    StorefrontApi.listBudgetProducts()
      .then((result) => {
        if (!active) return;
        setProducts(result);
        setSelectedProductId(resolveInitialProductId(result, initialProductId, initialProductSlug));
      })
      .catch((error) => {
        if (!active) return;
        setProductError(error instanceof Error ? error.message : "No pudimos cargar las opciones.");
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [initialProductId, initialProductSlug]);

  useEffect(() => {
    if (!products.length) return;
    if (selectedProductId === "") {
      setSelectedProductId(resolveInitialProductId(products, initialProductId, initialProductSlug));
      return;
    }

    const selectedExists = products.some((product) => product.id === selectedProductId);
    if (!selectedExists) {
      setSelectedProductId(resolveInitialProductId(products, initialProductId, initialProductSlug));
    }
  }, [initialProductId, initialProductSlug, products, selectedProductId]);

  useEffect(() => {
    setCustomerName(initialCustomerName);
  }, [initialCustomerName]);

  useEffect(() => {
    setCustomerEmail(initialCustomerEmail);
  }, [initialCustomerEmail]);

  useEffect(() => {
    setCustomerPhone(initialCustomerPhone);
  }, [initialCustomerPhone]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const productOptions = useMemo(
    () => products.map((product) => ({ value: String(product.id), label: product.name })),
    [products],
  );

  const selectedProductOption = useMemo(
    () => productOptions.find((option) => option.value === String(selectedProductId)) ?? null,
    [productOptions, selectedProductId],
  );

  useEffect(() => {
    setCalculation(null);
    setCalculationError(null);
    setConfirmation(null);
    setSubmitError(null);
    setCopyStatus("idle");
  }, [selectedProductId, width, height]);

  const activeCurrency = selectedCurrency ?? baseCurrency;
  const sourceCurrency = calculation?.currency ?? selectedProduct?.currency ?? baseCurrency;
  const formatBudgetAmount = useCallback(
    (amount: number, source?: string) => formatAmount(amount, source ?? sourceCurrency),
    [formatAmount, sourceCurrency],
  );
  const draftSubtotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.totalPrice * item.qty, 0),
    [draftItems],
  );
  const shareText = useMemo(
    () =>
      draftItems.length
        ? buildShareMessage(
            draftItems,
            activeCurrency,
            formatBudgetAmount,
            {
              name: toTrimmed(customerName),
              email: toTrimmed(customerEmail),
              phone: toTrimmed(customerPhone),
              notes: toTrimmed(customerNotes),
            },
          )
        : "",
    [activeCurrency, customerEmail, customerName, customerNotes, customerPhone, draftItems, formatBudgetAmount],
  );
  const shareSubject = "Presupuesto urucortinas";
  const shareWhatsappHref = useMemo(
    () => (shareText ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : "#"),
    [shareText],
  );
  const shareMailHref = useMemo(
    () => (shareText ? `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareText)}` : "#"),
    [shareText],
  );

  const widthError =
    widthTouched && !isValidDimension(width) ? "Ingresá el ancho en cm." : null;
  const heightError =
    heightTouched && !isValidDimension(height) ? "Ingresá el alto en cm." : null;

  const handleCalculate = async () => {
    setWidthTouched(true);
    setHeightTouched(true);

    const productId = Number(selectedProductId);
    const parsedWidth = formatDimension(width);
    const parsedHeight = formatDimension(height);
    const widthMeters = parsedWidth / 100;
    const heightMeters = parsedHeight / 100;

    if (!selectedProduct || !Number.isFinite(productId) || productId <= 0) {
      setCalculationError("Elegí una opción para continuar.");
      setCalculation(null);
      return;
    }

    if (!Number.isFinite(parsedWidth) || parsedWidth <= 0 || !Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      setCalculationError("Revisá las medidas para ver el precio.");
      setCalculation(null);
      return;
    }

    setLoadingCalculation(true);
    setCalculationError(null);

    try {
      const result = await StorefrontApi.calculateBudgetProduct({
        productId,
        width: widthMeters,
        height: heightMeters,
        currency: activeCurrency,
      });
      setCalculation(result);
    } catch (error) {
      setCalculation(null);
      setCalculationError(error instanceof Error ? error.message : "No pudimos calcular el precio.");
    } finally {
      setLoadingCalculation(false);
    }
  };

  const addCurrentDraftItem = () => {
    if (!calculation || !selectedProduct) return;

    setCalculation(null);
    setDraftItems((current) => {
      const itemCurrency = calculation.currency ?? selectedProduct.currency ?? activeCurrency;
      const fingerprint = `${calculation.productId}:${calculation.width}:${calculation.height}:${itemCurrency}`;
      const existingIndex = current.findIndex(
        (item) => `${item.productId}:${item.width}:${item.height}:${item.currency ?? itemCurrency}` === fingerprint,
      );

      const normalizedItem: DraftItem = { ...calculation, currency: itemCurrency, qty: 1 };

      if (existingIndex >= 0) {
        return current.map((item, index) => (index === existingIndex ? { ...item, qty: item.qty + 1 } : item));
      }

      return [...current, normalizedItem];
    });
  };

  const updateDraftQuantity = (index: number, delta: number) => {
    setDraftItems((current) =>
      current
        .map((item, currentIndex) => {
          if (currentIndex !== index) return item;
          const nextQty = Math.max(0, item.qty + delta);
          return nextQty === 0 ? null : { ...item, qty: nextQty };
        })
        .filter(Boolean) as DraftItem[],
    );
  };

  const removeDraftItem = (index: number) => {
    setDraftItems((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleShareWhatsapp = () => {
    if (!shareText) return;
    window.open(shareWhatsappHref, "_blank", "noopener,noreferrer");
  };

  const handleShareMail = () => {
    if (!shareText) return;
    window.location.href = shareMailHref;
  };

  const handleCopyShareText = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  const submitDraftItems = async () => {
    if (!draftItems.length || honeypot.trim().length > 0) {
      return;
    }

    setLoadingSubmit(true);
    setProductError(null);
    setCalculationError(null);
    setSubmitError(null);
    setConfirmation(null);

    try {
      const recaptchaToken = recaptchaSiteKey
        ? await executeRecaptchaAction(recaptchaSiteKey, "budget_submit")
        : null;

      const validated = await StorefrontApi.summarizeBudget({
        items: draftItems.map((item) => ({
          productId: item.productId,
          width: item.width,
          height: item.height,
          qty: item.qty,
        })),
        customerName: toTrimmed(customerName) || undefined,
        customerEmail: toTrimmed(customerEmail) || undefined,
        customerPhone: toTrimmed(customerPhone) || undefined,
        customerNotes: toTrimmed(customerNotes) || undefined,
        currency: activeCurrency,
      });

      const cartResponse = await StorefrontApi.addBudgetToCart({
        items: validated.items.map((item) => ({
          productId: item.productId,
          width: item.width,
          height: item.height,
          qty: item.qty,
        })),
        customerName: toTrimmed(customerName) || undefined,
        customerEmail: toTrimmed(customerEmail) || undefined,
        customerPhone: toTrimmed(customerPhone) || undefined,
        customerNotes: toTrimmed(customerNotes) || undefined,
        currency: activeCurrency,
        recaptchaToken: recaptchaToken ?? undefined,
      });

      cartResponse.items.forEach((item) => {
        if (!item.product) return;
        addItemSnapshot(
          {
            id: buildCartLineId(item.product, item),
            productId: item.product.id,
            slug: item.product.slug,
            name: item.product.name,
            price: {
              amount: item.totalPrice,
              currency: item.currency ?? sourceCurrency,
              formatted: formatBudgetAmount(item.totalPrice, item.currency ?? sourceCurrency),
            },
            salePrice: null,
            inventoryStatus: "in-stock",
            selectionSummary: `Ancho: ${item.width.toFixed(2)} m • Alto: ${item.height.toFixed(2)} m`,
          },
          item.qty,
        );
      });

      setConfirmation(cartResponse);
      setDraftItems([]);
      setCalculation(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos agregar el producto al carrito.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <Box>
      <Container>
        <Box style={{ padding: compact ? "20px 0 48px" : "24px 0 56px" }}>
          <Card1
            borderRadius={isProductTone ? 28 : 16}
            style={
              isProductTone
                ? {
                    overflow: "hidden",
                    border: "1px solid rgba(17, 33, 29, 0.08)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,247,241,0.96))",
                    boxShadow: "0 24px 54px rgba(17, 33, 29, 0.1)",
                  }
                : undefined
            }>
            <Box
              style={
                isProductTone
                  ? {
                      background:
                        "radial-gradient(circle at top left, rgba(205,160,73,0.1), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,247,241,0.98))",
                      borderBottom: "1px solid rgba(17, 33, 29, 0.06)",
                    }
                  : {
                      background: "linear-gradient(180deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0) 100%)",
                      borderBottom: "1px solid rgba(15,23,42,0.08)",
                    }
              }>
              <Box style={{ padding: compact ? "28px 0 20px" : "40px 0 24px" }}>
                <Typography fontSize="12px" color={isProductTone ? "gray.600" : "gray.500"} fontWeight="600">
                  {isProductTone ? "Presupuesto y decisión" : "Precio al instante"}
                </Typography>
                <H1 mt="8px">{title}</H1>
                {description ? (
                  <Paragraph mt="12px" color="gray.600" maxWidth="760px">
                    {description}
                  </Paragraph>
                ) : null}
              </Box>
            </Box>

            <Grid container spacing={6}>
              <Grid item lg={7} md={7} xs={12}>
                <FlexBox justifyContent="space-between" alignItems="center" mb="1rem">
                  <H3 mb="0">Elegí una opción</H3>
                  <Typography fontSize="12px" color="gray.600">
                    {loadingProducts ? "Cargando..." : `${products.length} opciones disponibles`}
                  </Typography>
                </FlexBox>

                {productError ? (
                  <Box mb="1rem">
                    <Paragraph color="error.main">{productError}</Paragraph>
                  </Box>
                ) : null}

                {!loadingProducts && products.length === 0 && !productError ? (
                  <Paragraph color="gray.600">No encontramos opciones disponibles en este momento.</Paragraph>
                ) : null}

                {products.length > 0 ? (
                  <>
                    {products.length > 1 ? (
                      <Select
                        label="Elegí una opción"
                        options={productOptions}
                        value={selectedProductOption}
                        onChange={(option: any) => setSelectedProductId(Number(option?.value ?? ""))}
                        placeholder="Elegí una opción"
                        mb="1rem"
                      />
                    ) : (
                      <Box mb="1rem">
                        <Typography fontWeight="600" fontSize="14px">
                          {selectedProduct?.name ?? "Producto seleccionado"}
                        </Typography>
                      </Box>
                    )}

                    <Grid container spacing={6}>
                      <Grid item sm={6} xs={12}>
                        <TextField
                          id="budget-width"
                          label="Ancho (cm)"
                          placeholder="Ej: 120"
                          type="number"
                          min={0}
                          step="0.01"
                          value={width}
                          onChange={(event) => setWidth(event.target.value)}
                          onBlur={() => setWidthTouched(true)}
                          errorText={widthError ?? undefined}
                          fullWidth
                        />
                      </Grid>
                      <Grid item sm={6} xs={12}>
                        <TextField
                          id="budget-height"
                          label="Alto (cm)"
                          placeholder="Ej: 150"
                          type="number"
                          min={0}
                          step="0.01"
                          value={height}
                          onChange={(event) => setHeight(event.target.value)}
                          onBlur={() => setHeightTouched(true)}
                          errorText={heightError ?? undefined}
                          fullWidth
                        />
                      </Grid>
                    </Grid>

                    {calculationError ? (
                      <Box mt="12px">
                        <Paragraph color="error.main">{calculationError}</Paragraph>
                      </Box>
                    ) : null}

                    <FlexBox flexWrap="wrap" style={{ gap: "12px" }} mt="1.5rem">
                      <Button
                        data-testid="budget-calculate"
                        variant="contained"
                        color="primary"
                        onClick={handleCalculate}
                        disabled={loadingCalculation || !selectedProduct}
                        style={
                          isProductTone
                            ? {
                                background: "#12352d",
                                color: "#f7f2e8",
                                boxShadow: "0 16px 32px rgba(18, 53, 45, 0.16)",
                              }
                            : undefined
                        }
                      >
                        {loadingCalculation ? "Calculando..." : "Calcular precio"}
                      </Button>
                    </FlexBox>

                    {calculation ? (
                      <Card1
                        data-testid="budget-result-card"
                        borderRadius={isProductTone ? 18 : 12}
                        mt="1.25rem"
                        p="16px"
                        boxShadow="none"
                        style={{
                          background: isProductTone ? "rgba(18, 53, 45, 0.04)" : "#f8fafc",
                          border: isProductTone ? "1px solid rgba(18, 53, 45, 0.08)" : undefined,
                        }}
                      >
                        <Typography fontSize="12px" color="gray.600" mb="0.35rem">
                          Resultado del presupuesto
                        </Typography>
                        <Typography
                          fontWeight="700"
                          color={isProductTone ? "#12352d" : "primary.main"}
                          fontSize="28px"
                          lineHeight="1.1"
                        >
                          {formatBudgetAmount(calculation.totalPrice, calculation.currency ?? sourceCurrency)}
                        </Typography>
                        <Typography color="gray.600" fontSize="14px" mt="0.6rem">
                          Medida: {formatDisplayedDimension(width).toFixed(0)} x {formatDisplayedDimension(height).toFixed(0)} cm
                        </Typography>
                        {calculation.product?.name ? (
                          <Typography color="gray.600" fontSize="14px" mt="0.2rem">
                            {calculation.product.name}
                          </Typography>
                        ) : null}
                        <Typography color="gray.600" fontSize="13px" mt="0.75rem">
                          {budgetDisclaimer}
                        </Typography>

                        <Button
                          data-testid="budget-add-to-list"
                          mt="1rem"
                          variant="outlined"
                          color="primary"
                          onClick={addCurrentDraftItem}
                          fullWidth
                        >
                          Agregar a la lista
                        </Button>
                      </Card1>
                    ) : null}
                  </>
                ) : null}
              </Grid>

              <Grid item lg={5} md={5} xs={12}>
                <Card1
                  borderRadius={isProductTone ? 18 : 16}
                  style={
                    isProductTone
                      ? {
                          background: "rgba(18, 53, 45, 0.03)",
                          border: "1px solid rgba(18, 53, 45, 0.08)",
                        }
                      : { background: "#fff" }
                  }
                >
                  <FlexBox justifyContent="space-between" alignItems="center" mb="1rem">
                    <H3 mb="0">Lista de presupuesto</H3>
                    <Typography fontSize="12px" color="gray.600">
                      {draftItems.length ? `${draftItems.length} ítems` : "0 ítems"}
                    </Typography>
                  </FlexBox>

                  {draftItems.length ? (
                    <Box>
                      {draftItems.map((item, index) => (
                        <BudgetLineItemCard
                          key={`${item.productId}-${item.width}-${item.height}-${item.currency ?? sourceCurrency}-${index}`}
                          item={item}
                          mb="1rem"
                          unitPriceLabel={formatBudgetAmount(item.unitPrice, item.currency ?? sourceCurrency)}
                          lineTotalLabel={formatBudgetAmount(item.totalPrice * item.qty, item.currency ?? sourceCurrency)}
                          onDecrease={() => updateDraftQuantity(index, -1)}
                          onIncrease={() => updateDraftQuantity(index, 1)}
                          onRemove={() => removeDraftItem(index)}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Paragraph color="gray.600">Todavía no agregaste productos al presupuesto.</Paragraph>
                  )}

                  <FlexBox justifyContent="space-between" alignItems="center" mt="1rem" mb="0.5rem">
                    <Typography fontWeight="600">Subtotal</Typography>
                    <Typography fontSize="24px" fontWeight="700" lineHeight="1">
                      {formatBudgetAmount(draftSubtotal, sourceCurrency)}
                    </Typography>
                  </FlexBox>

                  {submitError ? (
                    <Box mt="1rem">
                      <Paragraph color="error.main">{submitError}</Paragraph>
                    </Box>
                  ) : null}

                  <Button
                    mt="1rem"
                    variant="contained"
                    color="secondary"
                    onClick={submitDraftItems}
                    disabled={!draftItems.length || loadingSubmit || honeypot.trim().length > 0}
                    fullWidth
                  >
                    {loadingSubmit ? "Procesando..." : submitLabel}
                  </Button>

                  {confirmation ? (
                    <Box mt="1rem">
                      <Paragraph color="success.main">Tu presupuesto quedó listo para el carrito.</Paragraph>
                      <Link href="/cart">Ir al carrito</Link>
                    </Box>
                  ) : null}

                  <Box mt="1.25rem">
                    <FlexBox justifyContent="space-between" alignItems="center" mb="0.75rem">
                      <H3 mb="0">Compartir presupuesto</H3>
                      <Typography fontSize="12px" color="gray.600">
                        {shareText ? "Listo para compartir" : "Se habilita al agregar ítems"}
                      </Typography>
                    </FlexBox>

                    <Paragraph color="gray.600" fontSize="13px">
                      {budgetDisclaimer}
                    </Paragraph>

                    <Grid container spacing={3} mt="0.5rem">
                      <Grid item sm={4} xs={12}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="primary"
                          disabled={!shareText}
                          onClick={handleShareWhatsapp}
                        >
                          WhatsApp
                        </Button>
                      </Grid>
                      <Grid item sm={4} xs={12}>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="primary"
                          disabled={!shareText}
                          onClick={handleShareMail}
                        >
                          Email
                        </Button>
                      </Grid>
                      <Grid item sm={4} xs={12}>
                        <Button
                          fullWidth
                          variant="text"
                          color="primary"
                          disabled={!shareText}
                          onClick={handleCopyShareText}
                        >
                          Copiar texto
                        </Button>
                      </Grid>
                    </Grid>

                    {copyStatus === "copied" ? (
                      <Paragraph mt="0.75rem" color="success.main" fontSize="13px">
                        Texto copiado al portapapeles.
                      </Paragraph>
                    ) : null}
                    {copyStatus === "error" ? (
                      <Paragraph mt="0.75rem" color="error.main" fontSize="13px">
                        No pudimos copiar el texto.
                      </Paragraph>
                    ) : null}
                  </Box>

                  {onEditCustomer ? (
                    <Card1 borderRadius={14} mt="1.25rem" p="12px" boxShadow="none" style={{ background: "rgba(255,255,255,0.6)" }}>
                      <FlexBox justifyContent="space-between" alignItems="center" flexWrap="wrap" style={{ gap: "8px" }}>
                        <Box minWidth="0">
                          <Typography fontSize="12px" color="gray.600">
                            Tus datos
                          </Typography>
                          <Paragraph color="gray.700" mt="4px">
                            {customerName || "Sin nombre"} {customerEmail ? `· ${customerEmail}` : ""}{" "}
                            {customerPhone ? `· ${customerPhone}` : ""}
                          </Paragraph>
                        </Box>
                        <Button variant="text" color="primary" onClick={onEditCustomer}>
                          Editar datos
                        </Button>
                      </FlexBox>
                    </Card1>
                  ) : null}
                </Card1>
              </Grid>
            </Grid>
          </Card1>
        </Box>
      </Container>
    </Box>
  );
}
