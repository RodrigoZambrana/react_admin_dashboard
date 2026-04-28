"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import Typography, { H3 } from "@component/Typography";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useCheckout } from "@/state/checkout-context";
import { useCurrency } from "@/state/currency-context";
import { useStorefrontCart } from "@/state/cart-context";
import type { CreateOrderPayload, OrderSummary } from "@/types/storefront";
import {
  isMercadoPagoPaymentConfirmed,
  normalizeMercadoPagoStatus,
  type MercadoPagoNormalizedStatus
} from "@/utils/mercadopago";
import { readActiveOrderLock, writeOrderLock } from "@/utils/orderLock";
import {
  clearPersistedCheckoutOrderItems,
  loadPersistedCheckoutOrderItems,
  loadPersistedCheckoutState
} from "@/utils/checkoutStorage";
import { buildCheckoutOrderItems } from "@/lib/checkout/order-items";
import { useI18n, useTranslation } from "@/state/i18n-context";
import type { CartLineItem } from "@/state/cart-context";
import { trackPurchase } from "@/lib/analytics";

const DEFAULT_POSTAL_CODE_BY_COUNTRY: Record<string, string> = {
  UY: "11000"
};

const POSTAL_CODE_FALLBACK = "00000";

type OrderCreationState = "idle" | "processing" | "success" | "error";
const MAX_ORDER_AUTO_RETRIES = 3;

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
  const rawPaymentId = searchParams?.get("paymentId");
  const rawStatus = searchParams?.get("status");
  const rawDetail = searchParams?.get("detail");
  const rawMethod = searchParams?.get("method");
  const rawOrderUuid = searchParams?.get("orderUuid");
  const t = useTranslation();
  const { locale } = useI18n();

  const {
    contact,
    shippingAddress,
    fulfillmentMode,
    shippingOption,
    notes,
    payment,
    setPayment,
    setLastOrder,
    reset,
    checkoutToken
  } = useCheckout();
  const { state: cartState, clearCart } = useStorefrontCart();
  const { currency: activeCurrency } = useCurrency();

  const [orderState, setOrderState] = useState<OrderCreationState>("idle");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderRetryCount, setOrderRetryCount] = useState(0);
  const persistedCheckout = useMemo(() => loadPersistedCheckoutState(), []);
  const isCashSuccessFlow = rawMethod === "cod" || rawMethod === "cash";
  const persistedCashOrder = useMemo(() => {
    if (!isCashSuccessFlow) {
      return null;
    }
    const candidate = persistedCheckout?.lastOrder ?? null;
    if (!candidate) {
      return null;
    }
    if (rawOrderUuid && candidate.uuid !== rawOrderUuid) {
      return null;
    }
    return candidate;
  }, [isCashSuccessFlow, persistedCheckout?.lastOrder, rawOrderUuid]);
  const [createdOrder, setCreatedOrder] = useState<OrderSummary | null>(persistedCashOrder);
  const cashCleanupDoneRef = useRef(false);
  const purchaseTrackedRef = useRef(false);
  const paymentCheckoutSnapshot =
    payment?.method === "mercadopago" ? payment.checkoutSnapshot ?? null : null;

  const resolvedContact = paymentCheckoutSnapshot?.customer ?? persistedCheckout?.contact ?? contact;
  const resolvedShippingAddress =
    paymentCheckoutSnapshot?.shippingAddress ?? persistedCheckout?.shippingAddress ?? shippingAddress;
  const resolvedFulfillmentMode =
    paymentCheckoutSnapshot?.fulfillmentMode ?? persistedCheckout?.fulfillmentMode ?? fulfillmentMode;
  const resolvedShippingOption = useMemo(
    () =>
      paymentCheckoutSnapshot?.shippingOptionId
        ? {
            ...((persistedCheckout?.shippingOption ?? shippingOption ?? {}) as Record<string, unknown>),
            id: paymentCheckoutSnapshot.shippingOptionId
          }
        : persistedCheckout?.shippingOption ?? shippingOption,
    [paymentCheckoutSnapshot?.shippingOptionId, persistedCheckout?.shippingOption, shippingOption]
  );
  const resolvedNotes = paymentCheckoutSnapshot?.notes ?? persistedCheckout?.notes ?? notes;
  const resolvedCheckoutToken = persistedCheckout?.checkoutToken ?? checkoutToken;
  const persistedOrderItems = useMemo(
    () => loadPersistedCheckoutOrderItems(resolvedCheckoutToken),
    [resolvedCheckoutToken]
  );

  const paymentStatus = useMemo<MercadoPagoNormalizedStatus>(() => {
    if (isCashSuccessFlow) {
      return "pending";
    }
    if (payment?.method === "mercadopago") {
      return normalizeMercadoPagoStatus(payment.status);
    }
    return normalizeMercadoPagoStatus(rawStatus ?? undefined);
  }, [isCashSuccessFlow, payment, rawStatus]);

  const paymentId =
    rawPaymentId ??
    (payment?.method === "mercadopago" ? payment.paymentId ?? payment.paymentIntentId : null) ??
    "unknown";
  const detail =
    rawDetail ?? (payment?.method === "mercadopago" ? payment.statusDetail ?? null : null);
  const isConfirmedPayment = isMercadoPagoPaymentConfirmed(paymentStatus);
  const statusColor =
    isCashSuccessFlow
      ? "primary.main"
      : paymentStatus === "rejected"
      ? "error.main"
      : isConfirmedPayment
        ? "success.main"
        : "primary.main";
  const heading =
    isCashSuccessFlow
      ? t("checkout.review.heading.confirmed.cod", {
          defaultMessage: "Pedido recibido"
        })
      : paymentStatus === "rejected"
      ? t("checkout.payment.success.rejectedTitle", {
          defaultMessage: "Your payment was not approved"
        })
      : isConfirmedPayment
        ? t("checkout.payment.success.title", { defaultMessage: "Your payment is confirmed" })
        : t("checkout.payment.success.pendingTitle", {
            defaultMessage: "Your payment is still being reviewed"
          });
  const nextStepMessage =
    isCashSuccessFlow
      ? t("checkout.payment.success.cashNextStep", {
          defaultMessage:
            "Registramos tu pedido. El pago en efectivo quedará pendiente hasta que nuestro equipo lo confirme."
        })
      : paymentStatus === "rejected"
      ? t("checkout.payment.success.rejectedNextStep", {
          defaultMessage: "Choose another payment method to continue with checkout."
        })
      : isConfirmedPayment
        ? t("checkout.payment.success.confirmedNextStep", {
            defaultMessage: "You can follow the status of your purchase from My orders."
          })
        : t("checkout.payment.success.pendingNextStep", {
            defaultMessage: "Wait for approval before reviewing or confirming the order."
          });
  const primaryActionHref = isCashSuccessFlow || isConfirmedPayment ? "/account/orders" : "/payment";
  const primaryActionLabel =
    isCashSuccessFlow || isConfirmedPayment
      ? t("checkout.payment.success.actions.viewOrders", { defaultMessage: "View my orders" })
      : t("checkout.payment.success.actions.backToPayment", {
          defaultMessage: "Back to payment"
        });

  const resolveOrderConfirmationError = useCallback(
    (cause: unknown) => {
      if (!isApiError(cause)) {
        if (cause instanceof Error && cause.message.trim().length > 0) {
          return cause.message;
        }
        return t("checkout.payment.success.orderError", {
          defaultMessage: "We couldn't register your purchase. Please try again."
        });
      }

      const rawMessage = extractApiErrorMessage(cause);
      if (rawMessage === "errors.validation") {
        return t("checkout.payment.success.orderValidationError", {
          defaultMessage:
            "Mercado Pago confirmó el pago, pero todavía estamos terminando de registrar la compra."
        });
      }

      return rawMessage;
    },
    [t]
  );

  const translateStatus = useCallback(
    (value: string | null | undefined) => {
      const normalized = normalizeMercadoPagoStatus(value ?? undefined);
      const key = PAYMENT_STATUS_KEYS[normalized];
      if (key) {
        return t(key);
      }
      return (value && value.length > 0 ? value : null) ?? t("checkout.payment.shared.status", { defaultMessage: "Status" });
    },
    [t]
  );

  const orderItemsData = useMemo(() => buildCheckoutOrderItems(cartState.items), [cartState.items]);
  const resolvedOrderItems = useMemo(() => {
    if (paymentCheckoutSnapshot?.items && paymentCheckoutSnapshot.items.length > 0) {
      return paymentCheckoutSnapshot.items;
    }
    if (persistedOrderItems && persistedOrderItems.length > 0) {
      return persistedOrderItems;
    }
    if (orderItemsData.items.length > 0 && !orderItemsData.error) {
      return orderItemsData.items;
    }
    return orderItemsData.items;
  }, [orderItemsData.error, orderItemsData.items, paymentCheckoutSnapshot?.items, persistedOrderItems]);
  const orderItemsError = useMemo(() => {
    if (resolvedOrderItems.length > 0) {
      return null;
    }
    return orderItemsData.error;
  }, [orderItemsData.error, resolvedOrderItems.length]);

  const canAttemptOrderCreation = useMemo(() => {
    const hasResolvablePayment =
      isConfirmedPayment &&
      ((payment?.method === "mercadopago" && Boolean(payment.paymentIntentId)) || Boolean(rawPaymentId));

    if (!hasResolvablePayment) {
      return false;
    }
    if (orderItemsError) {
      return false;
    }
    if (resolvedOrderItems.length === 0) {
      return false;
    }
    if (!resolvedContact.email || !resolvedShippingAddress?.line1 || !resolvedShippingAddress?.city || !resolvedShippingAddress?.country) {
      return false;
    }
    if (!resolvedShippingOption?.id) {
      return false;
    }
    return true;
  }, [
    isConfirmedPayment,
    orderItemsError,
    payment,
    rawPaymentId,
    resolvedContact.email,
    resolvedShippingAddress,
    resolvedOrderItems.length,
    resolvedShippingOption?.id
  ]);

  const subtitle =
    isCashSuccessFlow
      ? t("checkout.payment.success.cashSubtitle", {
          defaultMessage:
            "Tu compra fue registrada correctamente. Te mostramos el resumen del pedido y el estado del pago en efectivo."
        })
      : paymentStatus === "rejected"
      ? t("checkout.payment.success.rejectedSubtitle", {
          defaultMessage:
            "Mercado Pago did not confirm this payment. Review the details and try another method."
        })
      : isConfirmedPayment
        ? canAttemptOrderCreation
          ? t("checkout.payment.success.subtitleWithOrderRegistration", {
              defaultMessage:
                "Mercado Pago confirmó tu pago. Estamos terminando de registrar tu compra y te mostramos el resultado abajo."
            })
          : t("checkout.payment.success.subtitle", {
              defaultMessage:
                "Mercado Pago confirmed your payment. You can review the payment details below."
            })
        : t("checkout.payment.success.pendingSubtitle", {
            defaultMessage:
              "Mercado Pago has not confirmed this payment yet. Return to payment to retry later or wait for the final status."
          });

  const finalizeOrder = useCallback(async () => {
    if (!canAttemptOrderCreation) {
      return;
    }

    let resolvedPayment = payment;
    if ((!resolvedPayment || resolvedPayment.method !== "mercadopago" || !resolvedPayment.paymentIntentId) && rawPaymentId) {
      try {
        const paymentRecord = await StorefrontApi.resolveMercadoPagoPayment({
          externalPaymentId: rawPaymentId,
          cartId: `cart-${cartState.updatedAt}`,
          checkoutToken: resolvedCheckoutToken,
          payerEmail: resolvedContact.email
        });
        resolvedPayment = {
          method: "mercadopago",
          paymentIntentId: paymentRecord.paymentIntentId,
          paymentId: paymentRecord.paymentId ?? undefined,
          status: normalizeMercadoPagoStatus(paymentRecord.status),
          statusDetail: paymentRecord.statusDetail ?? undefined,
          currency: paymentRecord.currency,
          amount: paymentRecord.amount,
          installments: paymentRecord.installments ?? undefined,
          cardBrand: paymentRecord.cardBrand ?? undefined,
          cardLastFour: paymentRecord.cardLastFour ?? undefined,
          cardholderName: paymentRecord.cardholderName ?? undefined,
          updatedAt: paymentRecord.createdAt
        };
        setPayment(resolvedPayment);
      } catch (cause) {
        const message = resolveOrderConfirmationError(cause);
        setOrderError(message);
        setOrderState("error");
        return;
      }
    }

    if (!resolvedPayment || resolvedPayment.method !== "mercadopago" || !resolvedPayment.paymentIntentId) {
      setOrderError(
        t("checkout.payment.success.orderError", {
          defaultMessage: "We couldn't confirm your order. Please try again."
        })
      );
      setOrderState("error");
      return;
    }

    const checkoutOrderKey =
      typeof window !== "undefined" && resolvedCheckoutToken
        ? `storefront:order:${resolvedCheckoutToken}`
        : null;

    if (typeof window !== "undefined") {
      const completionKey = `storefront:order:${resolvedPayment.paymentIntentId}`;
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
      const resolvedCheckoutSnapshot = resolvedPayment.checkoutSnapshot ?? paymentCheckoutSnapshot ?? null;
      const checkoutCustomer = resolvedCheckoutSnapshot?.customer ?? resolvedContact;
      const checkoutCustomerLocale =
        typeof resolvedCheckoutSnapshot?.customer?.locale === "string"
          ? resolvedCheckoutSnapshot.customer.locale
          : locale;
      const checkoutShippingAddress = resolvedCheckoutSnapshot?.shippingAddress ?? resolvedShippingAddress;
      const checkoutItems = resolvedCheckoutSnapshot?.items ?? resolvedOrderItems;
      const checkoutNotes = resolvedCheckoutSnapshot?.notes ?? resolvedNotes;
      const checkoutShippingOptionId =
        resolvedCheckoutSnapshot?.shippingOptionId ?? resolvedShippingOption?.id;
      const checkoutFulfillmentMode =
        resolvedCheckoutSnapshot?.fulfillmentMode ?? resolvedFulfillmentMode;
      const checkoutCurrency = resolvedCheckoutSnapshot?.currency ?? activeCurrency;

      const resolvedZip =
        typeof checkoutShippingAddress.zip === "string" && checkoutShippingAddress.zip.trim().length > 0
          ? checkoutShippingAddress.zip.trim()
          : DEFAULT_POSTAL_CODE_BY_COUNTRY[checkoutShippingAddress.country] ?? POSTAL_CODE_FALLBACK;

      const shippingAddressPayload: CreateOrderPayload["shippingAddress"] = {
        line1: checkoutShippingAddress.line1,
        line2: checkoutShippingAddress.line2 || undefined,
        street: checkoutShippingAddress.street || undefined,
        number: checkoutShippingAddress.number || undefined,
        corner: checkoutShippingAddress.corner || undefined,
        apartment: checkoutShippingAddress.apartment || undefined,
        comments: checkoutShippingAddress.comments || undefined,
        city: checkoutShippingAddress.city,
        department:
          checkoutShippingAddress.department ||
          checkoutShippingAddress.state ||
          checkoutShippingAddress.city,
        neighborhood: checkoutShippingAddress.neighborhood || undefined,
        state: checkoutShippingAddress.state || undefined,
        zip: resolvedZip,
        country: checkoutShippingAddress.country
      };

      const payload: CreateOrderPayload = {
        customer: {
          ...(checkoutCustomer.email ? { email: checkoutCustomer.email } : {}),
          firstName: checkoutCustomer.firstName,
          lastName: checkoutCustomer.lastName,
          phone: checkoutCustomer.phone ?? "",
          locale: checkoutCustomerLocale
        },
        shippingAddress: shippingAddressPayload,
        items: checkoutItems,
        notes: checkoutNotes && checkoutNotes.trim().length > 0 ? checkoutNotes.trim() : undefined,
        paymentIntentId: resolvedPayment.paymentIntentId,
        checkoutToken: resolvedCheckoutToken,
        shippingOptionId: checkoutShippingOptionId,
        fulfillmentMode: checkoutFulfillmentMode,
        currency: checkoutCurrency
      };

      const order = await StorefrontApi.createOrder(payload);

      if (typeof window !== "undefined") {
        const completionKey = `storefront:order:${resolvedPayment.paymentIntentId}`;
        writeOrderLock(completionKey);
        if (checkoutOrderKey) {
          writeOrderLock(checkoutOrderKey);
        }
      }

      setLastOrder(order);
      setCreatedOrder(order);
      clearCart();
      clearPersistedCheckoutOrderItems(resolvedCheckoutToken);
      reset();
      setOrderState("success");
      setOrderRetryCount(0);
    } catch (cause) {
      const message = resolveOrderConfirmationError(cause);
      setOrderError(message);
      setOrderState("error");
    }
  }, [
    canAttemptOrderCreation,
    clearCart,
    activeCurrency,
    resolvedOrderItems,
    payment,
    cartState.updatedAt,
    locale,
    rawPaymentId,
    resolvedCheckoutToken,
    resolvedFulfillmentMode,
    resolvedNotes,
    paymentCheckoutSnapshot,
    resolvedShippingOption,
    resolvedContact,
    resolvedShippingAddress,
    reset,
    resolveOrderConfirmationError,
    setPayment,
    setLastOrder,
    t
  ]);

  const orderLabel = createdOrder ? `#${createdOrder.orderNumber ?? createdOrder.uuid}` : null;
  const orderTotalLabel = createdOrder
    ? new Intl.NumberFormat(locale === "en" ? "en-US" : "es-UY", {
        style: "currency",
        currency: createdOrder.summary.grandTotal.currency
      }).format(createdOrder.summary.grandTotal.amount)
    : null;
  const deliveryEstimateLabel = createdOrder?.delivery?.estimatedLabel ?? null;

  useEffect(() => {
    if (orderState === "idle" && canAttemptOrderCreation) {
      void finalizeOrder();
    }
  }, [canAttemptOrderCreation, finalizeOrder, orderState]);

  useEffect(() => {
    if (!isCashSuccessFlow || cashCleanupDoneRef.current) {
      return;
    }

    cashCleanupDoneRef.current = true;

    if (persistedCashOrder) {
      setCreatedOrder(persistedCashOrder);
      setOrderState("success");
      setOrderError(null);
    } else {
      setCreatedOrder(null);
      setOrderState("error");
      setOrderError(
        t("checkout.payment.success.cashMissingOrder", {
          defaultMessage:
            "No pudimos recuperar el resumen del pedido en esta sesión. Revísalo desde Mis pedidos."
        })
      );
    }

    clearCart();
    clearPersistedCheckoutOrderItems(resolvedCheckoutToken);
    reset();
  }, [
    clearCart,
    isCashSuccessFlow,
    persistedCashOrder,
    reset,
    resolvedCheckoutToken,
    t
  ]);

  useEffect(() => {
    if (!canAttemptOrderCreation || orderState !== "error" || orderRetryCount >= MAX_ORDER_AUTO_RETRIES) {
      return;
    }

    const delayMs = 2500 * (orderRetryCount + 1);
    const timer = window.setTimeout(() => {
      setOrderRetryCount((current) => current + 1);
      void finalizeOrder();
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canAttemptOrderCreation, finalizeOrder, orderRetryCount, orderState]);

  useEffect(() => {
    if (orderItemsError) {
      setOrderError(orderItemsError);
      setOrderState("error");
    }
  }, [orderItemsError]);

  useEffect(() => {
    if (purchaseTrackedRef.current) {
      return;
    }
    if (orderState !== "success" || !createdOrder) {
      return;
    }
    trackPurchase(createdOrder);
    purchaseTrackedRef.current = true;
  }, [createdOrder, orderState]);

  return (
    <Box py="6rem">
      <FlexBox flexDirection="column" alignItems="center" justifyContent="center" px="1.5rem">
        <Card1 maxWidth="540px" width="100%" textAlign="center" p="2.5rem">
          <H3 fontWeight="700" mb="0.5rem" color="primary.main">
            {heading}
          </H3>
          <Typography color="text.muted" mb="2rem">
            {subtitle}
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
                  {t("checkout.payment.success.orderConfirming", {
                    defaultMessage: "We are registering your purchase..."
                  })}
                </Typography>
              ) : orderState === "error" ? (
                <>
                  <Typography color="error.main" mb="1rem">
                    {orderError ??
                      t("checkout.payment.success.orderError", {
                        defaultMessage: "We are still finishing the registration of your purchase."
                      })}
                  </Typography>
                  <Typography color="text.muted" fontSize="14px">
                    {orderRetryCount < MAX_ORDER_AUTO_RETRIES
                      ? t("checkout.payment.success.orderRetryInBackground", {
                          defaultMessage:
                            "We will retry automatically in the background. If your purchase does not appear in My orders in a few minutes, contact support."
                        })
                      : t("checkout.payment.success.orderRetryExhausted", {
                          defaultMessage:
                            "We could not finish registering the purchase automatically. If it does not appear in My orders in a few minutes, contact support."
                        })}
                  </Typography>
                </>
              ) : (
                <Typography color="text.muted" mb="1rem">
                  {t("checkout.payment.success.orderPreparing", {
                    defaultMessage: "Preparing the registration of your purchase..."
                  })}
                </Typography>
              )}
            </Box>
          ) : isCashSuccessFlow ? (
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
              <Typography color={statusColor}>
                {t("checkout.review.paymentSummary.cod", {
                  defaultMessage: "Pago en efectivo pendiente de confirmación"
                })}
              </Typography>
            </Box>
          ) : (
            <Box
              border="1px solid"
              borderColor="gray.200"
              borderRadius="12px"
              p="1.25rem"
              textAlign="left"
              mb="2rem"
            >
              <Typography fontWeight="600" mb="0.5rem">
                {t("checkout.payment.success.nextStep", { defaultMessage: "Next step" })}
              </Typography>
              <Typography color={statusColor}>{nextStepMessage}</Typography>
            </Box>
          )}

          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="12px"
            p="1.5rem"
            textAlign="left"
            mb="2rem"
            maxWidth="100%"
          >
            {createdOrder ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  {t("checkout.payment.success.orderReference", {
                    defaultMessage: "Order reference"
                  })}
                </Typography>
                <Typography color="text.muted" mb="1rem">
                  {orderLabel}
                </Typography>

                {orderTotalLabel ? (
                  <>
                    <Typography fontWeight="600" mb="0.5rem">
                      {t("checkout.payment.success.orderTotal", {
                        defaultMessage: "Order total"
                      })}
                    </Typography>
                    <Typography color="text.muted" mb="1rem">
                      {orderTotalLabel}
                    </Typography>
                  </>
                ) : null}

                {deliveryEstimateLabel ? (
                  <>
                    <Typography fontWeight="600" mb="0.5rem">
                      {t("checkout.payment.success.deliveryEstimate", {
                        defaultMessage: "Estimated delivery"
                      })}
                    </Typography>
                    <Typography color="text.muted" mb="1rem">
                      {deliveryEstimateLabel}
                    </Typography>
                  </>
                ) : null}
              </>
            ) : null}

            <Typography fontWeight="600" mb="0.5rem">
              {t(
                isCashSuccessFlow
                  ? "checkout.payment.shared.paymentStatus"
                  : "checkout.payment.shared.status",
                { defaultMessage: isCashSuccessFlow ? "Estado del pago" : "Status" }
              )}
            </Typography>
            <Typography color={statusColor} mb="1rem">
              {isCashSuccessFlow
                ? t("checkout.review.paymentSummary.cod", {
                    defaultMessage: "Pago en efectivo pendiente de confirmación"
                  })
                : translateStatus(paymentStatus)}
            </Typography>

            {!isCashSuccessFlow ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  {t("checkout.payment.shared.reference", { defaultMessage: "Payment reference" })}
                </Typography>
                <Typography color="text.muted" mb="1rem">
                  {paymentId}
                </Typography>
              </>
            ) : null}

            {detail && !isCashSuccessFlow ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  {t("checkout.payment.shared.mercadoPagoDetail", { defaultMessage: "Mercado Pago detail" })}
                </Typography>
                <Typography color="text.muted">{t(detail, { defaultMessage: detail })}</Typography>
              </>
            ) : null}
          </Box>

          <FlexBox justifyContent="center" flexWrap="wrap" style={{ gap: "1rem" }}>
            <Link href={primaryActionHref} style={{ textDecoration: "none" }}>
              <Button color="primary" variant="contained">
                {primaryActionLabel}
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
