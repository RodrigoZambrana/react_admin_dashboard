"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Box from "@component/Box";
import Container from "@component/Container";
import FlexBox from "@component/FlexBox";
import Grid from "@component/grid/Grid";
import Typography, { H1, H3, Paragraph } from "@component/Typography";
import Select from "@component/Select";
import TextField from "@component/text-field";
import { Button } from "@component/buttons";
import { Card1 } from "@component/Card1";

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
  showCustomerFields = true,
  submitLabel = "Agregar al carrito",
  onEditCustomer,
}: Props) {
  void showCustomerFields;
  void initialCustomerName;
  void initialCustomerEmail;
  void initialCustomerPhone;
  void initialCustomerNotes;
  void onEditCustomer;
  void submitLabel;

  const { addItemSnapshot } = useStorefrontCart();
  const config = useStorefrontConfig();
  const { baseCurrency, currency: selectedCurrency, formatAmount } = useMoneyFormatter();

  const [products, setProducts] = useState<BudgetProductSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [width, setWidth] = useState(initialWidth > 1 ? String(initialWidth) : "");
  const [height, setHeight] = useState(initialHeight > 1 ? String(initialHeight) : "");
  const [widthTouched, setWidthTouched] = useState(false);
  const [heightTouched, setHeightTouched] = useState(false);
  const [calculation, setCalculation] = useState<BudgetCalculationResult | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCalculation, setLoadingCalculation] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BudgetAddToCartResponse | null>(null);

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
  }, [selectedProductId, width, height]);

  const activeCurrency = selectedCurrency ?? baseCurrency;
  const sourceCurrency = calculation?.currency ?? selectedProduct?.currency ?? baseCurrency;
  const formatBudgetAmount = (amount: number, source?: string) => formatAmount(amount, source ?? sourceCurrency);

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

  const handleAddToCart = async () => {
    if (!calculation || !selectedProduct) {
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

      const cartResponse = await StorefrontApi.addBudgetToCart({
        items: [
          {
            productId: calculation.productId,
            width: calculation.width,
            height: calculation.height,
            qty: 1,
          },
        ],
        currency: activeCurrency,
        recaptchaToken: recaptchaToken ?? undefined,
      });

      const [item] = cartResponse.items;
      if (item?.product) {
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
            selectionSummary: `Medida: ${formatDisplayedDimension(width)} x ${formatDisplayedDimension(height)} cm`,
          },
          item.qty,
        );
      }

      setConfirmation(cartResponse);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos agregar el producto al carrito.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <Box>
      <Box
        style={{
          background: "linear-gradient(180deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0) 100%)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        <Container>
          <Box style={{ padding: compact ? "28px 0 20px" : "40px 0 24px" }}>
            <Typography fontSize="12px" color="gray.500" fontWeight="600">
              Precio al instante
            </Typography>
            <H1 mt="8px">{title}</H1>
            {description ? (
              <Paragraph mt="12px" color="gray.600" maxWidth="760px">
                {description}
              </Paragraph>
            ) : null}
          </Box>
        </Container>
      </Box>

      <Container>
        <Box style={{ padding: compact ? "20px 0 48px" : "24px 0 56px" }}>
          <Card1 borderRadius={16}>
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
                      >
                        {loadingCalculation ? "Calculando..." : "Calcular precio"}
                      </Button>
                    </FlexBox>
                  </>
                ) : null}

                {calculation ? (
                  <Card1
                    data-testid="budget-result-card"
                    borderRadius={12}
                    mt="1.25rem"
                    p="16px"
                    boxShadow="none"
                    style={{ background: "#f8fafc" }}
                  >
                    <Typography fontSize="12px" color="gray.600" mb="0.35rem">
                      Precio estimado
                    </Typography>
                    <Typography fontWeight="700" color="primary.main" fontSize="28px" lineHeight="1.1">
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

                    <Button
                      data-testid="budget-add-to-list"
                      mt="1rem"
                      variant="outlined"
                      color="primary"
                      onClick={handleAddToCart}
                      disabled={loadingSubmit}
                      fullWidth
                    >
                      {loadingSubmit ? "Agregando..." : "Agregar al carrito"}
                    </Button>
                  </Card1>
                ) : null}
              </Grid>

              <Grid item lg={5} md={5} xs={12}>
                <Card1 borderRadius={16} style={{ background: "#fff" }}>
                  <Typography fontSize="12px" color="gray.600">
                    Cómo sigue
                  </Typography>
                  <Paragraph mt="8px" color="gray.700">
                    Ingresá las medidas, mirá el precio al instante y agregalo al carrito cuando quieras seguir.
                  </Paragraph>

                  {confirmation ? (
                    <Box mt="1rem">
                      <Paragraph color="success.main">Tu producto quedó listo para el carrito.</Paragraph>
                      <Link href="/cart">Ir al carrito</Link>
                    </Box>
                  ) : null}

                  {submitError ? (
                    <Box mt="1rem">
                      <Paragraph color="error.main">{submitError}</Paragraph>
                    </Box>
                  ) : null}

                  {calculation ? (
                    <Box mt="1rem">
                      <Paragraph color="gray.600" fontSize="13px">
                        Ya tenés el precio estimado. Podés seguir con la compra o ajustar las medidas y recalcular.
                      </Paragraph>
                    </Box>
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
