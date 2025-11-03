"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import Typography from "@component/Typography";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { useCheckout } from "@/state/checkout-context";
import { useStorefrontCart } from "@/state/cart-context";
import type { CreateOrderPayload } from "@/types/storefront";

const DEFAULT_POSTAL_CODE_BY_COUNTRY: Record<string, string> = {
  UY: "11000"
};

const POSTAL_CODE_FALLBACK = "00000";

type OrderCreationState = "idle" | "processing" | "success" | "error";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId") ?? "unknown";
  const status = searchParams.get("status") ?? "approved";
  const detail = searchParams.get("detail");

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

  const [orderState, setOrderState] = useState<OrderCreationState>("idle");
  const [orderError, setOrderError] = useState<string | null>(null);

  const orderItems = useMemo(
    () =>
      cartState.items
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
          return {
            productId,
            quantity: Math.max(1, item.quantity),
            variantId,
            configuration: item.product.configuration ?? undefined
          };
        })
        .filter(Boolean) as Array<{
        productId: number;
        quantity: number;
        variantId?: number;
        configuration?: Record<string, unknown>;
      }>,
    [cartState.items]
  );

  const canAttemptOrderCreation = useMemo(() => {
    if (!payment || payment.method !== "mercadopago") {
      return false;
    }
    if (!["approved", "authorized"].includes(payment.status)) {
      return false;
    }
    if (orderItems.length === 0) {
      return false;
    }
    if (!contact.email || !shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.country) {
      return false;
    }
    return true;
  }, [contact.email, orderItems.length, payment, shippingAddress]);

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
      if (
        sessionStorage.getItem(completionKey) === "completed" ||
        (checkoutOrderKey && sessionStorage.getItem(checkoutOrderKey) === "completed")
      ) {
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

      const payload = {
        customer: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone && contact.phone.length > 0 ? contact.phone : undefined
        },
        shippingAddress: shippingAddressPayload,
        items: orderItems,
        notes: notes && notes.trim().length > 0 ? notes.trim() : undefined,
        paymentIntentId: payment.paymentIntentId,
        checkoutToken
      };

      const order = await StorefrontApi.createOrder(payload);

      if (typeof window !== "undefined") {
        const completionKey = `storefront:order:${payment.paymentIntentId}`;
        sessionStorage.setItem(completionKey, "completed");
        if (checkoutOrderKey) {
          sessionStorage.setItem(checkoutOrderKey, "completed");
        }
      }

      setLastOrder(order);
      clearCart();
      reset();
      setOrderState("success");
    } catch (cause) {
      const message = isApiError(cause)
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "We couldn't confirm your order. Please try again.";
      setOrderError(message);
      setOrderState("error");
    }
  }, [
    canAttemptOrderCreation,
    clearCart,
    contact.email,
    contact.firstName,
    contact.lastName,
    contact.phone,
    notes,
    orderItems,
    payment,
    reset,
    setLastOrder,
    shippingAddress.city,
    shippingAddress.country,
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.state,
    shippingAddress.zip,
    checkoutToken
  ]);

  useEffect(() => {
    if (orderState === "idle" && canAttemptOrderCreation) {
      void finalizeOrder();
    }
  }, [canAttemptOrderCreation, finalizeOrder, orderState]);

  const handleRetry = useCallback(() => {
    setOrderState("idle");
    setOrderError(null);
    void finalizeOrder();
  }, [finalizeOrder]);

  return (
    <Box py="6rem">
      <FlexBox flexDirection="column" alignItems="center" justifyContent="center" px="1.5rem">
        <Card1 maxWidth="540px" width="100%" textAlign="center" p="2.5rem">
          <Typography variant="h3" fontWeight="700" mb="0.5rem" color="primary.main">
            Your payment is confirmed
          </Typography>
          <Typography color="text.muted" mb="2rem">
            Thank you for completing your purchase with Mercado Pago. You can review the payment details below.
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
                Order status
              </Typography>
              {orderState === "success" ? (
                <Typography color="success.main" mb="1rem">
                  Your order was registered successfully.
                </Typography>
              ) : orderState === "processing" ? (
                <Typography color="text.muted" mb="1rem">
                  Confirming your order...
                </Typography>
              ) : orderState === "error" ? (
                <>
                  <Typography color="error.main" mb="1rem">
                    {orderError ?? "We couldn't confirm your order. Please try again."}
                  </Typography>
                  <Button variant="outlined" color="primary" onClick={handleRetry}>
                    Retry confirmation
                  </Button>
                </>
              ) : (
                <Typography color="text.muted" mb="1rem">
                  Preparing to confirm your order...
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
              Status
            </Typography>
            <Typography color="success.main" mb="1rem">
              {status}
            </Typography>

            <Typography fontWeight="600" mb="0.5rem">
              Payment reference
            </Typography>
            <Typography color="text.muted" mb="1rem">
              {paymentId}
            </Typography>

            {detail ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  Mercado Pago detail
                </Typography>
                <Typography color="text.muted">{detail}</Typography>
              </>
            ) : null}
          </Box>

          <FlexBox justifyContent="center" flexWrap="wrap" gap="1rem">
            <Button as={Link} href="/account/orders" color="primary" variant="contained">
              View my orders
            </Button>
            <Button as={Link} href="/shop" color="primary" variant="outlined">
              Continue shopping
            </Button>
          </FlexBox>
        </Card1>
      </FlexBox>
    </Box>
  );
}
