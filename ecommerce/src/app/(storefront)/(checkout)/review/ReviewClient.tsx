"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import { Button } from "@component/buttons";
import Typography, { H2, Paragraph } from "@component/Typography";

import CheckoutCostSummary from "@/components/cart/CheckoutCostSummary";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { normalizeMoney } from "@/lib/utils/format";
import { useCheckout } from "@/state/checkout-context";
import { useCurrency } from "@/state/currency-context";
import { useStorefrontCart } from "@/state/cart-context";
import type { CheckoutPayment } from "@/state/checkout-context";
import type { CreateOrderPayload, Money, OrderSummary } from "@/types/storefront";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useToast } from "@/contexts/ToastContext";
import { normalizeMercadoPagoStatus } from "@/utils/mercadopago";
import {
  clearOrderLock,
  readActiveOrderLock,
  writeOrderLock
} from "@/utils/orderLock";
import type { MercadoPagoNormalizedStatus } from "@/utils/mercadopago";
import { useI18n, useTranslation } from "@/state/i18n-context";
import type { CartLineItem } from "@/state/cart-context";
import type { CartLineItem } from "@/state/cart-context";

const DEFAULT_POSTAL_CODE_BY_COUNTRY: Record<string, string> = {
  UY: "11000"
};
const POSTAL_CODE_FALLBACK = "00000";

type ReviewItem = {
  id: number | string;
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
};

const PAYMENT_STATUS_LABEL_KEYS: Record<MercadoPagoNormalizedStatus, string> = {
  approved: "checkout.review.paymentStatus.approved",
  authorized: "checkout.review.paymentStatus.authorized",
  in_process: "checkout.review.paymentStatus.in_process",
  pending: "checkout.review.paymentStatus.pending",
  processing: "checkout.review.paymentStatus.processing",
  rejected: "checkout.review.paymentStatus.rejected"
};

const mapOrderPaymentToCheckoutPayment = (
  orderPayment: OrderSummary["payment"] | null | undefined,
  order: OrderSummary
): CheckoutPayment | null => {
  if (!orderPayment) {
    return null;
  }

  const provider = orderPayment.provider?.toLowerCase() ?? "";
  const hasMercadoPagoReference = provider === "mercadopago" || Boolean(orderPayment.paymentIntentId);

  if (hasMercadoPagoReference) {
    const normalizedStatus = normalizeMercadoPagoStatus(orderPayment.status);
    const amountCurrency = orderPayment.amount?.currency ?? order.summary.grandTotal.currency ?? "USD";
    const amountValue = orderPayment.amount?.amount ?? order.summary.grandTotal.amount;

    return {
      method: "mercadopago",
      paymentIntentId: orderPayment.paymentIntentId ?? "",
      paymentId: orderPayment.paymentId ?? undefined,
      status: normalizedStatus,
      statusDetail: orderPayment.statusDetail ?? undefined,
      currency: amountCurrency,
      amount: amountValue,
      installments: orderPayment.installments ?? undefined,
      cardBrand: orderPayment.cardBrand ?? undefined,
      cardLastFour: orderPayment.cardLastFour ?? undefined,
      cardholderName: orderPayment.cardholderName ?? undefined,
      updatedAt: orderPayment.updatedAt ?? order.placedAt
    };
  }

  if (provider === "cod" || provider === "cash" || provider === "cash on delivery") {
    return { method: "cod" };
  }

  return null;
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
  return { config: raw as Record<string, unknown> };
};

const formatAddress = (address: {
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string | null;
  zip?: string | null;
  country?: string;
}) => {
  const cityStateParts: string[] = [];
  const cityValue = (address.city ?? "").trim();
  const stateValue = (address.state ?? "").trim();
  if (cityValue) {
    cityStateParts.push(cityValue);
  }
  if (stateValue && stateValue.toLowerCase() !== cityValue.toLowerCase()) {
    cityStateParts.push(stateValue);
  }

  const parts = [
    address.line1,
    address.line2,
    cityStateParts.join(", "),
    address.country
  ]
    .filter(Boolean)
    .map((part) => part!.toString().trim())
    .filter((part) => part.length > 0);
  return parts.join("\n");
};

export default function ReviewClient() {
  const router = useRouter();
  const { state: cartState, clearCart } = useStorefrontCart();
  const {
    contact,
    shippingAddress,
    payment,
    notes,
    hasPayment,
    lastOrder,
    setLastOrder,
    reset,
    checkoutToken
  } = useCheckout();
  const { locale } = useI18n();
  const t = useTranslation();
  const normalizeParametricConfiguration = useCallback(
    (item: CartLineItem): Record<string, unknown> | undefined => {
      const raw = item.product.configuration;
      if (!raw || typeof raw !== "object") {
        return undefined;
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

      return normalized;
    },
    []
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<CheckoutPayment | null>(null);
  const [confirmedContact, setConfirmedContact] = useState<{ name: string; email: string } | null>(
    null
  );
  const { formatMoney: formatDisplayMoney } = useMoneyFormatter();
  const toast = useToast();
  const { currency: activeCurrency } = useCurrency();

  const reviewItems = useMemo<ReviewItem[]>(() => {
    return cartState.items.map((item) => {
      const unitPrice = normalizeMoney(item.product.salePrice ?? item.product.price);
      const lineTotal = normalizeMoney({
        amount: unitPrice.amount * item.quantity,
        currency: unitPrice.currency
      });
      return {
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal
      };
    });
  }, [cartState.items]);

  useEffect(() => {
    if (!lastOrder && cartState.items.length === 0) {
      router.replace("/cart");
    }
  }, [cartState.items.length, lastOrder, router]);

  useEffect(() => {
    if (!lastOrder && !hasPayment) {
      router.replace("/payment");
    }
  }, [hasPayment, lastOrder, router]);

  const orderItemsData = useMemo(() => {
    const items = cartState.items
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
        const configuration =
          item.product.mode === "parametric" || hasConfigObject
            ? normalizeParametricConfiguration(item)
            : item.product.configuration ?? undefined;

        return {
          productId,
          quantity: Math.max(1, item.quantity),
          variantId,
          configuration
        };
      })
      .filter(Boolean) as Array<{ productId: number; quantity: number; variantId?: number; configuration?: Record<string, unknown> }>;

    return { items, error: null as string | null };
  }, [cartState.items]);

  const handlePlaceOrder = useCallback(async () => {
    if (isSubmitting) return;
    setErrorMessage(null);

    const orderLockKey =
      typeof window !== "undefined" && checkoutToken
        ? `storefront:order:${checkoutToken}`
        : null;

    if (orderLockKey && typeof window !== "undefined") {
      const existingLock = readActiveOrderLock(orderLockKey);
      if (existingLock) {
        toast.info({
          title: t("checkout.review.toast.alreadyProcessed.title"),
          description: t("checkout.review.toast.alreadyProcessed.description")
        });
        return;
      }
      clearOrderLock(orderLockKey);
    }

    if (!contact.firstName || !contact.lastName || !contact.email) {
      const message = t("checkout.review.errors.contactIncompleteMessage");
      setErrorMessage(message);
      toast.error({
        title: t("checkout.review.errors.contactIncompleteTitle"),
        description: t("checkout.review.errors.contactIncompleteDescription")
      });
      router.push("/checkout");
      return;
    }

    const hasShippingAddress =
      shippingAddress.line1 && shippingAddress.city && shippingAddress.country;
    if (!hasShippingAddress) {
      const message = t("checkout.review.errors.addressIncompleteMessage");
      setErrorMessage(message);
      toast.error({
        title: t("checkout.review.errors.addressIncompleteTitle"),
        description: t("checkout.review.errors.addressIncompleteDescription")
      });
      router.push("/checkout");
      return;
    }

    const orderItems = orderItemsData.items;

    if (orderItems.length === 0) {
      const message = t("checkout.review.errors.emptyCartMessage");
      setErrorMessage(message);
      toast.info({
        title: t("checkout.review.toast.emptyCartTitle"),
        description: t("checkout.review.toast.emptyCartDescription")
      });
      router.replace("/cart");
      return;
    }

    setIsSubmitting(true);
    try {
      const nameForConfirmation = [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const resolvedZip =
        typeof shippingAddress.zip === "string" && shippingAddress.zip.trim().length > 0
          ? shippingAddress.zip.trim()
          : DEFAULT_POSTAL_CODE_BY_COUNTRY[shippingAddress.country] ?? POSTAL_CODE_FALLBACK;

      const shippingAddressPayload: CreateOrderPayload["shippingAddress"] = {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || undefined,
        city: shippingAddress.city,
        state: shippingAddress.state || undefined,
        zip: resolvedZip,
        country: shippingAddress.country
      };

      const payload: CreateOrderPayload = {
        customer: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone && contact.phone.length > 0 ? contact.phone : undefined,
          locale
        },
        shippingAddress: shippingAddressPayload,
        items: orderItems,
        notes: notes.trim().length > 0 ? notes.trim() : undefined,
        paymentIntentId:
          payment && payment.method === "mercadopago" ? payment.paymentIntentId : undefined,
        checkoutToken,
        currency: activeCurrency
      };

      const order = await StorefrontApi.createOrder(payload);
      const normalizedPayment =
        mapOrderPaymentToCheckoutPayment(order.payment ?? null, order) ?? payment ?? null;
      setConfirmedPayment(normalizedPayment);
      setConfirmedContact({
        name: nameForConfirmation || contact.email,
        email: contact.email
      });
      if (orderLockKey && typeof window !== "undefined") {
        writeOrderLock(orderLockKey);
      }
      clearCart();
      reset();
      setLastOrder(order);
      const orderLabel = order.orderNumber || `#${order.id}`;
      toast.success({
        title: t("checkout.review.toast.success.title"),
        description: orderLabel
          ? t("checkout.review.toast.success.descriptionWithId", { values: { orderLabel } })
          : t("checkout.review.toast.success.description")
      });
    } catch (cause) {
      const message = isApiError(cause)
        ? (() => {
            const detail =
              typeof cause.details === "object" && cause.details !== null && "message" in cause.details
                ? String((cause.details as { message?: unknown }).message ?? "").trim()
                : "";
            return detail || cause.message;
          })()
        : cause instanceof Error
          ? cause.message
          : t("checkout.review.errors.placeOrderFailed");
      setErrorMessage(message);
      toast.error({
        title: t("checkout.review.toast.error.title"),
        description: message
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeCurrency,
    cartState.items,
    checkoutToken,
    clearCart,
    contact.email,
    contact.firstName,
    contact.lastName,
    contact.phone,
    orderItemsData,
    isSubmitting,
    notes,
    payment,
    reset,
    router,
    setLastOrder,
    shippingAddress.city,
    shippingAddress.country,
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.state,
    shippingAddress.zip,
    locale,
    toast,
    t
  ]);

  const contactName = useMemo(
    () => [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim(),
    [contact.firstName, contact.lastName]
  );

  const paymentSummary = useMemo(() => {
    const source = confirmedPayment ?? payment;
    if (!source) {
      return t("checkout.review.paymentSummary.notSet");
    }
    if (source.method === "cod") {
      return t("checkout.review.paymentSummary.cod");
    }
    const status = normalizeMercadoPagoStatus(source.status);
    const brand = source.cardBrand ?? "Mercado Pago";
    const ending = source.cardLastFour
      ? ` ${t("checkout.review.paymentSummary.cardEnding", { values: { lastFour: source.cardLastFour } })}`
      : "";
    const statusKey = PAYMENT_STATUS_LABEL_KEYS[status] ?? "checkout.review.paymentStatus.generic";
    const statusLabel = t(statusKey);
    return `${brand}${ending} · ${statusLabel}`;
  }, [confirmedPayment, payment, t]);

  const shippingAddressText = useMemo(
    () => formatAddress(lastOrder?.shippingAddress ?? shippingAddress),
    [lastOrder, shippingAddress]
  );

  const hasOrderConfirmation = Boolean(lastOrder);
  const confirmationSummary = lastOrder?.summary;
  const confirmationName =
    confirmedContact?.name || contactName || t("checkout.review.confirmation.defaultName");
  const confirmationEmail = confirmedContact?.email || contact.email;
  const confirmationEmailLabel =
    confirmationEmail || t("checkout.review.confirmation.yourEmail");
  const confirmationOrderLabel = lastOrder
    ? `#${lastOrder.orderNumber ?? lastOrder.id}`
    : "";

  return (
    <Box>
      <Box mb="2rem">
        <H2 fontWeight={600} mb="0.5rem">
          {t(
            hasOrderConfirmation
              ? "checkout.review.heading.confirmed"
              : "checkout.review.heading.review"
          )}
        </H2>
        <Paragraph color="text.muted" maxWidth="520px">
          {t(
            hasOrderConfirmation
              ? "checkout.review.subheading.confirmed"
              : "checkout.review.subheading.review"
          )}
        </Paragraph>
      </Box>

      {hasOrderConfirmation && lastOrder ? (
        <Box>
          <Card1 mb="2rem">
            <Typography color="primary.main" fontWeight="600" mb="0.5rem">
              {t("checkout.review.confirmation.thankYou", { values: { name: confirmationName } })}
            </Typography>
            <Typography fontWeight="600" fontSize="18px" mb="0.5rem">
              {t("checkout.review.confirmation.orderLabel", {
                values: { orderLabel: confirmationOrderLabel }
              })}
            </Typography>
            <Paragraph color="text.muted" mb="1rem">
              {t("checkout.review.confirmation.updates", {
                values: { email: confirmationEmailLabel }
              })}
            </Paragraph>
            <Typography fontWeight="500" mb="0.25rem">
              {t("checkout.review.confirmation.shippingTitle")}
            </Typography>
            <Typography color="text.muted" style={{ whiteSpace: "pre-line" }}>
              {shippingAddressText || t("checkout.review.confirmation.noShipping")}
            </Typography>
          </Card1>

          <Card1 mb="2rem">
            <Typography fontWeight="600" fontSize="18px" mb="1rem">
              {t("checkout.review.items.title")}
            </Typography>
            {lastOrder.items.map((item) => (
              <Box key={item.productId} mb="1rem">
                <Typography fontWeight="500">
                  {item.name ?? t("checkout.review.items.productFallback", { values: { id: item.productId } })}
                </Typography>
                <Typography color="text.muted">
                  {t("checkout.review.items.quantityPrice", {
                    values: {
                      quantity: item.quantity,
                      price: formatDisplayMoney(item.price)
                    }
                  })}
                </Typography>
              </Box>
            ))}
            <Divider mb="1rem" />
            {confirmationSummary && (
              <Box>
                <FlexBox justifyContent="space-between" mb="0.5rem">
                  <Typography color="text.hint">{t("checkout.review.summary.subtotal")}</Typography>
                  <Typography fontWeight="600">
                    {formatDisplayMoney(confirmationSummary.subtotal)}
                  </Typography>
                </FlexBox>
                <FlexBox justifyContent="space-between" mb="0.5rem">
                  <Typography color="text.hint">{t("checkout.review.summary.shipping")}</Typography>
                  <Typography fontWeight="600">
                    {formatDisplayMoney(confirmationSummary.shipping)}
                  </Typography>
                </FlexBox>
                <FlexBox justifyContent="space-between" mb="0.5rem">
                  <Typography color="text.hint">{t("checkout.review.summary.tax")}</Typography>
                  <Typography fontWeight="600">
                    {formatDisplayMoney(confirmationSummary.tax)}
                  </Typography>
                </FlexBox>
                <Divider mb="0.75rem" />
                <FlexBox justifyContent="space-between" alignItems="center">
                  <Typography fontWeight="600">{t("checkout.review.summary.total")}</Typography>
                  <Typography fontWeight="700" fontSize="22px">
                    {formatDisplayMoney(confirmationSummary.grandTotal)}
                  </Typography>
                </FlexBox>
                <Divider my="0.75rem" />
                <Typography fontWeight="500" mb="0.25rem">
                  {t("checkout.review.summary.paymentTitle")}
                </Typography>
                <Typography color="text.muted">{paymentSummary}</Typography>
                {confirmationSummary.notes && confirmationSummary.notes.length > 0 && (
                  <>
                    <Divider my="0.75rem" />
                    <Typography fontWeight="500" mb="0.25rem">
                      {t("checkout.review.summary.deliveryNotesTitle")}
                    </Typography>
                    <Typography color="text.muted">{confirmationSummary.notes}</Typography>
                  </>
                )}
              </Box>
            )}
          </Card1>

          <FlexBox flexWrap="wrap" mt="1rem" style={{ gap: "1rem" }}>
            <Link href="/shop">
              <Button variant="contained" color="primary">
                {t("checkout.review.actions.continue")}
              </Button>
            </Link>
            <Link href="/account/orders">
              <Button variant="outlined" color="primary">
                {t("checkout.review.actions.viewOrders")}
              </Button>
            </Link>
          </FlexBox>
        </Box>
      ) : (
        <Grid container spacing={6}>
          <Grid item lg={8} md={8} xs={12}>
            <Card1 mb="1.5rem">
              <Typography fontWeight="600" fontSize="18px" mb="1rem">
                {t("checkout.review.items.title")}
              </Typography>
              {reviewItems.map((item, index) => {
                const isLast = index === reviewItems.length - 1;
                return (
                  <Box
                    key={item.id}
                    mb={isLast ? 0 : "1rem"}
                    pb={isLast ? 0 : "1rem"}
                    borderBottom={isLast ? "none" : "1px solid"}
                    borderColor={isLast ? undefined : "gray.200"}>
                  <FlexBox justifyContent="space-between">
                    <Box mr="1rem">
                      <Typography fontWeight="500">{item.name}</Typography>
                      <Typography color="text.hint">
                    {t("checkout.review.items.quantityPrice", {
                      values: { quantity: item.quantity, price: formatDisplayMoney(item.unitPrice) }
                    })}
                  </Typography>
                </Box>
                <Typography fontWeight="600">{formatDisplayMoney(item.lineTotal)}</Typography>
              </FlexBox>
                  </Box>
                );
              })}
            </Card1>

            <Card1 mb="1.5rem">
              <Typography fontWeight="600" fontSize="18px" mb="1rem">
                {t("checkout.review.contact.title")}
              </Typography>
              <Typography fontWeight="500" mb="0.25rem">
                {contactName || contact.email}
              </Typography>
              <Typography color="text.muted" mb="1rem">
                {contact.email}
                {contact.phone ? ` · ${contact.phone}` : ""}
              </Typography>
              <Typography fontWeight="500" mb="0.25rem">
                {t("checkout.review.contact.shippingTitle")}
              </Typography>
              <Typography color="text.muted" style={{ whiteSpace: "pre-line" }}>
                {shippingAddressText || t("checkout.review.contact.noShipping")}
              </Typography>
            </Card1>

            <Card1>
              <Typography fontWeight="600" fontSize="18px" mb="0.5rem">
                {t("checkout.review.payment.title")}
              </Typography>
              <Typography color="text.muted">{paymentSummary}</Typography>
              {notes.trim().length > 0 && (
                <>
                  <Divider my="1rem" />
                  <Typography fontWeight="600" fontSize="16px" mb="0.5rem">
                    {t("checkout.review.payment.notesTitle")}
                  </Typography>
                  <Typography color="text.muted">{notes}</Typography>
                </>
              )}
            </Card1>
          </Grid>

          <Grid item lg={4} md={4} xs={12}>
            <CheckoutCostSummary actionHref={null} />
            {errorMessage && (
              <Typography color="error.main" mt="1rem">
                {errorMessage}
              </Typography>
            )}
            <Button
              variant="contained"
              color="primary"
              fullWidth
              mt="1.5rem"
              disabled={isSubmitting}
              onClick={handlePlaceOrder}>
              {isSubmitting
                ? t("checkout.review.actions.placingOrder")
                : t("checkout.review.actions.placeOrder")}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              mt="0.75rem"
              onClick={() => router.push("/payment")}>
              {t("checkout.review.actions.backToPayment")}
            </Button>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
