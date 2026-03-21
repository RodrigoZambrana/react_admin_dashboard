"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import Typography, { H3 } from "@component/Typography";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { useCheckout } from "@/state/checkout-context";
import { useCurrency } from "@/state/currency-context";
import { useStorefrontCart } from "@/state/cart-context";
import type { CreateOrderPayload } from "@/types/storefront";
import { readActiveOrderLock, writeOrderLock } from "@/utils/orderLock";
import { useTranslation } from "@/state/i18n-context";
import type { CartLineItem } from "@/state/cart-context";

const DEFAULT_POSTAL_CODE_BY_COUNTRY: Record<string, string> = {
  UY: "11000"
};

const POSTAL_CODE_FALLBACK = "00000";

type OrderCreationState = "idle" | "processing" | "success" | "error";

const PAYMENT_STATUS_KEYS: Record<string, string> = {
  approved: "checkout.review.paymentStatus.approved",
  authorized: "checkout.review.paymentStatus.authorized",
  in_process: "checkout.review.paymentStatus.in_process",
  pending: "checkout.review.paymentStatus.pending",
  processing: "checkout.review.paymentStatus.processing",
  rejected: "checkout.review.paymentStatus.rejected"
};

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessSkeleton />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams?.get("paymentId") ?? "unknown";
  const status = searchParams?.get("status") ?? "approved";
  const detail = searchParams?.get("detail");
  const t = useTranslation();

  const {
    contact,
    shippingAddress,
    notes,
    payment,
    setLastOrder,
    reset,
    checkoutToken
  } = useCheckout();
  const { state: cartState, clearCart } = useStorefrontCart();
  const { currency: activeCurrency } = useCurrency();
  const localeValue = typeof navigator !== "undefined" ? navigator.language : undefined;

  const [orderState, setOrderState] = useState<OrderCreationState>("idle");
  const [orderError, setOrderError] = useState<string | null>(null);

  const normalizeParametricConfiguration = (item: CartLineItem): { config?: Record<string, unknown>; error?: string } => {
    const raw = item.product.configuration;
    if (!raw || typeof raw !== "object") {
      return { error: `Falta la configuración paramétrica para ${item.product.name}.` };
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
    if (maybeWidth === undefined || maybeHeight === undefined || maybeWidth <= 0 || maybeHeight <= 0) {
      return { error: `Medidas inválidas para ${item.product.name}. Completa ancho y alto.` };
    }
    const widthMm = maybeWidth !== undefined ? Math.round(maybeWidth > 10 ? maybeWidth : maybeWidth * 1000) : undefined;
    const heightMm = maybeHeight !== undefined ? Math.round(maybeHeight > 10 ? maybeHeight : maybeHeight * 1000) : undefined;

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

  const translateStatus = useCallback(
    (value: string | null | undefined) => {
      const normalized = (value ?? "").toLowerCase();
      const key = PAYMENT_STATUS_KEYS[normalized];
      if (key) {
        return t(key);
      }
      return (value && value.length > 0 ? value : null) ?? t("checkout.payment.shared.status", { defaultMessage: "Status" });
    },
    [t]
  );

  const orderItemsData = useMemo(() => {
    let configError: string | null = null;
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

        if (item.product.mode === "parametric" || hasConfigObject) {
          const { config, error } = normalizeParametricConfiguration(item);
          if (error) {
            configError = error;
            return null;
          }
          return {
            productId,
            quantity: Math.max(1, item.quantity),
            variantId,
            configuration: config
          };
        }

        configError = configError ?? `Falta configuración para el producto "${item.product.name}". Reconfigúralo antes de continuar.`;
        return null;
      })
      .filter(Boolean) as Array<{
      productId: number;
      quantity: number;
      variantId?: number;
      configuration?: Record<string, unknown>;
    }>;
    return { items, error: configError };
  }, [cartState.items]);

  const canAttemptOrderCreation = useMemo(() => {
    if (!payment || payment.method !== "mercadopago") {
      return false;
    }
    if (!["approved", "authorized"].includes(payment.status)) {
      return false;
    }
    if (orderItemsData.error) {
      return false;
    }
    if (orderItemsData.items.length === 0) {
      return false;
    }
    if (!contact.email || !shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.country) {
      return false;
    }
    return true;
  }, [contact.email, orderItemsData.error, orderItemsData.items.length, payment, shippingAddress]);

  const finalizeOrder = useCallback(async () => {
    if (!canAttemptOrderCreation || !payment || payment.method !== "mercadopago") {
      return;
    }

    const checkoutOrderKey =
      typeof window !== "undefined" && checkoutToken
        ? `storefront:order:${checkoutToken}`
        : null;

    if (typeof window !== "undefined") {
      const completionKey = `storefront:order:${payment.paymentIntentId}`;
      const completionLock = readActiveOrderLock(completionKey);
      const checkoutLock =
        checkoutOrderKey && typeof checkoutOrderKey === "string"
          ? readActiveOrderLock(checkoutOrderKey)
          : null;
      if (completionLock || checkoutLock) {
        setOrderState("success");
        return;
      }
    }

    setOrderState("processing");
    setOrderError(null);

    try {
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
          locale: localeValue
        },
        shippingAddress: shippingAddressPayload,
        items: orderItemsData.items,
        notes: notes && notes.trim().length > 0 ? notes.trim() : undefined,
        paymentIntentId: payment.paymentIntentId,
        checkoutToken,
        currency: activeCurrency
      };

      const order = await StorefrontApi.createOrder(payload);

      if (typeof window !== "undefined") {
        const completionKey = `storefront:order:${payment.paymentIntentId}`;
        writeOrderLock(completionKey);
        if (checkoutOrderKey) {
          writeOrderLock(checkoutOrderKey);
        }
      }

      setLastOrder(order);
      clearCart();
      reset();
      setOrderState("success");
    } catch (cause) {
      const fallbackMessage = t("checkout.payment.success.orderError", {
        defaultMessage: "We couldn't confirm your order. Please try again."
      });
      const message = isApiError(cause)
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : fallbackMessage;
      setOrderError(message);
      setOrderState("error");
    }
  }, [
    canAttemptOrderCreation,
    clearCart,
    contact.email,
    contact.firstName,
    contact.lastName,
    localeValue,
    contact.phone,
    notes,
    orderItemsData,
    payment,
    reset,
    setLastOrder,
    shippingAddress.city,
    shippingAddress.country,
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.state,
    shippingAddress.zip,
    checkoutToken,
    activeCurrency,
    t
  ]);

  useEffect(() => {
    if (orderState === "idle" && canAttemptOrderCreation) {
      void finalizeOrder();
    }
  }, [canAttemptOrderCreation, finalizeOrder, orderState]);

  useEffect(() => {
    if (orderItemsData.error) {
      setOrderError(orderItemsData.error);
      setOrderState("error");
    }
  }, [orderItemsData.error]);

  const handleRetry = useCallback(() => {
    setOrderState("idle");
    setOrderError(null);
    void finalizeOrder();
  }, [finalizeOrder]);

  return (
    <Box py="6rem">
      <FlexBox flexDirection="column" alignItems="center" justifyContent="center" px="1.5rem">
        <Card1 maxWidth="540px" width="100%" textAlign="center" p="2.5rem">
          <H3 fontWeight="700" mb="0.5rem" color="primary.main">
            {t("checkout.payment.success.title", { defaultMessage: "Your payment is confirmed" })}
          </H3>
          <Typography color="text.muted" mb="2rem">
            {t("checkout.payment.success.subtitle", {
              defaultMessage:
                "Thank you for completing your purchase with Mercado Pago. You can review the payment details below."
            })}
          </Typography>

          {canAttemptOrderCreation ? (
            <Box
              border="1px solid"
              borderColor="gray.200"
              borderRadius="12px"
              p="1.25rem"
              textAlign="left"
              mb="2rem"
            >
              <Typography fontWeight="600" mb="0.5rem">
                {t("checkout.payment.success.orderStatus", { defaultMessage: "Order status" })}
              </Typography>
              {orderState === "success" ? (
                <Typography color="success.main" mb="1rem">
                  {t("checkout.payment.success.orderRegistered", {
                    defaultMessage: "Your order was registered successfully."
                  })}
                </Typography>
              ) : orderState === "processing" ? (
                <Typography color="text.muted" mb="1rem">
                  {t("checkout.payment.success.orderConfirming", { defaultMessage: "Confirming your order..." })}
                </Typography>
              ) : orderState === "error" ? (
                <>
                  <Typography color="error.main" mb="1rem">
                    {orderError ??
                      t("checkout.payment.success.orderError", {
                        defaultMessage: "We couldn't confirm your order. Please try again."
                      })}
                  </Typography>
                  <Button variant="outlined" color="primary" onClick={handleRetry}>
                    {t("checkout.payment.success.orderRetry", { defaultMessage: "Retry confirmation" })}
                  </Button>
                </>
              ) : (
                <Typography color="text.muted" mb="1rem">
                  {t("checkout.payment.success.orderPreparing", {
                    defaultMessage: "Preparing to confirm your order..."
                  })}
                </Typography>
              )}
            </Box>
          ) : null}

          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="12px"
            p="1.5rem"
            textAlign="left"
            mb="2rem"
            maxWidth="100%"
          >
            <Typography fontWeight="600" mb="0.5rem">
              {t("checkout.payment.shared.status", { defaultMessage: "Status" })}
            </Typography>
            <Typography color="success.main" mb="1rem">
              {translateStatus(status)}
            </Typography>

            <Typography fontWeight="600" mb="0.5rem">
              {t("checkout.payment.shared.reference", { defaultMessage: "Payment reference" })}
            </Typography>
            <Typography color="text.muted" mb="1rem">
              {paymentId}
            </Typography>

            {detail ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  {t("checkout.payment.shared.mercadoPagoDetail", { defaultMessage: "Mercado Pago detail" })}
                </Typography>
                <Typography color="text.muted">{t(detail, { defaultMessage: detail })}</Typography>
              </>
            ) : null}
          </Box>

          <FlexBox justifyContent="center" flexWrap="wrap" style={{ gap: "1rem" }}>
            <Link href="/account/orders" style={{ textDecoration: "none" }}>
              <Button color="primary" variant="contained">
                {t("checkout.payment.success.actions.viewOrders", { defaultMessage: "View my orders" })}
              </Button>
            </Link>
            <Link href="/shop" style={{ textDecoration: "none" }}>
              <Button color="primary" variant="outlined">
                {t("checkout.payment.success.actions.continue", { defaultMessage: "Continue shopping" })}
              </Button>
            </Link>
          </FlexBox>
        </Card1>
      </FlexBox>
    </Box>
  );
}

function PaymentSuccessSkeleton() {
  const t = useTranslation();
  return (
    <Box py="6rem">
      <FlexBox flexDirection="column" alignItems="center" justifyContent="center" px="1.5rem">
        <Card1 maxWidth="540px" width="100%" textAlign="center" p="2.5rem">
          <H3 fontWeight="700" mb="0.5rem" color="primary.main">
            {t("checkout.payment.success.processingTitle", { defaultMessage: "Finalizing your payment..." })}
          </H3>
          <Typography color="text.muted">
            {t("checkout.payment.success.processingSubtitle", {
              defaultMessage: "Hang tight while we load the confirmation details."
            })}
          </Typography>
        </Card1>
      </FlexBox>
    </Box>
  );
}
