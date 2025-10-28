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
import { useStorefrontCart } from "@/state/cart-context";
import type { CheckoutPayment } from "@/state/checkout-context";
import type { CreateOrderPayload, Money } from "@/types/storefront";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useToast } from "@/contexts/ToastContext";
import {
  buildMercadoPagoStatusMessage,
  normalizeMercadoPagoStatus
} from "@/utils/mercadopago";
import type { MercadoPagoNormalizedStatus } from "@/utils/mercadopago";

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

const PAYMENT_STATUS_LABELS: Record<MercadoPagoNormalizedStatus, string> = {
  approved: "Approved",
  authorized: "Authorized",
  in_process: "Under review",
  pending: "Pending",
  processing: "Processing",
  rejected: "Rejected"
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
    reset
  } = useCheckout();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<CheckoutPayment | null>(null);
  const [confirmedContact, setConfirmedContact] = useState<{ name: string; email: string } | null>(
    null
  );
  const { formatMoney: formatDisplayMoney } = useMoneyFormatter();
  const toast = useToast();

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

  const handlePlaceOrder = useCallback(async () => {
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!contact.firstName || !contact.lastName || !contact.email) {
      const message = "Your contact details are incomplete. Please return to checkout.";
      setErrorMessage(message);
      toast.error({
        title: "Completa tus datos de contacto",
        description: "Necesitamos el nombre y el correo para finalizar tu pedido."
      });
      router.push("/checkout");
      return;
    }

    const hasShippingAddress =
      shippingAddress.line1 && shippingAddress.city && shippingAddress.country;
    if (!hasShippingAddress) {
      const message = "Your shipping address is incomplete. Please return to checkout.";
      setErrorMessage(message);
      toast.error({
        title: "Dirección de envío incompleta",
        description: "Revisa tu dirección antes de confirmar el pedido."
      });
      router.push("/checkout");
      return;
    }

    const orderItems = cartState.items
      .map((item) => {
        const productId = Number(item.product.id);
        if (!Number.isFinite(productId)) {
          return null;
        }
        return {
          productId,
          quantity: Math.max(1, item.quantity)
        };
      })
      .filter(Boolean) as Array<{ productId: number; quantity: number }>;

    if (orderItems.length === 0) {
      setErrorMessage("Your cart is empty.");
      toast.info({
        title: "Tu carrito está vacío",
        description: "Agrega productos para poder confirmar el pedido."
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

      const payload = {
        customer: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone && contact.phone.length > 0 ? contact.phone : undefined
        },
        shippingAddress: shippingAddressPayload,
        items: orderItems,
        notes: notes.trim().length > 0 ? notes.trim() : undefined
      };

      const order = await StorefrontApi.createOrder(payload);
      setConfirmedPayment(payment ?? null);
      setConfirmedContact({
        name: nameForConfirmation || contact.email,
        email: contact.email
      });
      clearCart();
      reset();
      setLastOrder(order);
      const orderLabel = order.orderNumber || order.uuid;
      toast.success({
        title: "Pedido confirmado",
        description: orderLabel
          ? `Registramos tu pedido ${orderLabel}. Recibirás un correo con los detalles.`
          : "Registramos tu pedido. Recibirás un correo con los detalles."
      });
    } catch (cause) {
      const message = isApiError(cause)
        ? cause.payload?.message ?? cause.message
        : cause instanceof Error
          ? cause.message
          : "We couldn't place your order. Please try again.";
      setErrorMessage(message);
      toast.error({
        title: "No pudimos confirmar tu pedido",
        description: message
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    cartState.items,
    clearCart,
    contact.email,
    contact.firstName,
    contact.lastName,
    contact.phone,
    notes,
    payment,
    reset,
    router,
    setLastOrder,
    setConfirmedContact,
    shippingAddress.city,
    shippingAddress.country,
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.state,
    isSubmitting,
    toast
  ]);

  const contactName = useMemo(
    () => [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim(),
    [contact.firstName, contact.lastName]
  );

  const paymentSummary = useMemo(() => {
    const source = confirmedPayment ?? payment;
    if (!source) {
      return "Not set";
    }
    if (source.method === "cod") {
      return "Cash on delivery";
    }
    const status = normalizeMercadoPagoStatus(source.status);
    const brand = source.cardBrand ?? "Mercado Pago";
    const ending = source.cardLastFour ? ` ending in ${source.cardLastFour}` : "";
    const statusLabel = PAYMENT_STATUS_LABELS[status] ?? "Status";
    return `${brand}${ending} · ${statusLabel}`;
  }, [confirmedPayment, payment]);

  const shippingAddressText = useMemo(
    () => formatAddress(lastOrder?.shippingAddress ?? shippingAddress),
    [lastOrder, shippingAddress]
  );

  const hasOrderConfirmation = Boolean(lastOrder);
  const confirmationSummary = lastOrder?.summary;
  const confirmationName = confirmedContact?.name || contactName || "there";
  const confirmationEmail = confirmedContact?.email || contact.email;

  return (
    <Box>
      <Box mb="2rem">
        <H2 fontWeight={600} mb="0.5rem">
          {hasOrderConfirmation ? "Order confirmed" : "Review your order"}
        </H2>
        <Paragraph color="text.muted" maxWidth="520px">
          {hasOrderConfirmation
            ? "Thank you for shopping with us. Your order has been placed successfully."
            : "Confirm your shipping information and totals. You can return to prior steps if any detail needs to be updated."}
        </Paragraph>
      </Box>

      {hasOrderConfirmation && lastOrder ? (
        <Box>
          <Card1 mb="2rem">
            <Typography color="primary.main" fontWeight="600" mb="0.5rem">
              Thank you, {confirmationName}!
            </Typography>
            <Typography fontWeight="600" fontSize="18px" mb="0.5rem">
              Order #{lastOrder.orderNumber}
            </Typography>
            <Paragraph color="text.muted" mb="1rem">
              We&apos;ll send updates to {confirmationEmail || "your email"}.
            </Paragraph>
            <Typography fontWeight="500" mb="0.25rem">
              Shipping to
            </Typography>
            <Typography color="text.muted" style={{ whiteSpace: "pre-line" }}>
              {shippingAddressText || "No shipping address available"}
            </Typography>
          </Card1>

          <Card1 mb="2rem">
            <Typography fontWeight="600" fontSize="18px" mb="1rem">
              Items
            </Typography>
            {lastOrder.items.map((item) => (
              <Box key={item.productId} mb="1rem">
                <Typography fontWeight="500">{item.name ?? `Product #${item.productId}`}</Typography>
                <Typography color="text.muted">
                  Qty {item.quantity} · {formatDisplayMoney(item.price)} each
                </Typography>
              </Box>
            ))}
            <Divider mb="1rem" />
            {confirmationSummary && (
              <Box>
                <FlexBox justifyContent="space-between" mb="0.5rem">
                  <Typography color="text.hint">Subtotal</Typography>
                  <Typography fontWeight="600">
                    {formatDisplayMoney(confirmationSummary.subtotal)}
                  </Typography>
                </FlexBox>
                <FlexBox justifyContent="space-between" mb="0.5rem">
                  <Typography color="text.hint">Shipping</Typography>
                  <Typography fontWeight="600">
                    {formatDisplayMoney(confirmationSummary.shipping)}
                  </Typography>
                </FlexBox>
                <FlexBox justifyContent="space-between" mb="0.5rem">
                  <Typography color="text.hint">Tax</Typography>
                  <Typography fontWeight="600">
                    {formatDisplayMoney(confirmationSummary.tax)}
                  </Typography>
                </FlexBox>
                <Divider mb="0.75rem" />
                <FlexBox justifyContent="space-between" alignItems="center">
                  <Typography fontWeight="600">Total</Typography>
                  <Typography fontWeight="700" fontSize="22px">
                    {formatDisplayMoney(confirmationSummary.grandTotal)}
                  </Typography>
                </FlexBox>
                <Divider my="0.75rem" />
                <Typography fontWeight="500" mb="0.25rem">
                  Payment method
                </Typography>
                <Typography color="text.muted">{paymentSummary}</Typography>
                {confirmationSummary.notes && confirmationSummary.notes.length > 0 && (
                  <>
                    <Divider my="0.75rem" />
                    <Typography fontWeight="500" mb="0.25rem">
                      Delivery notes
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
                Continue shopping
              </Button>
            </Link>
            <Link href="/account/orders">
              <Button variant="outlined" color="primary">
                View your orders
              </Button>
            </Link>
          </FlexBox>
        </Box>
      ) : (
        <Grid container spacing={6}>
          <Grid item lg={8} md={8} xs={12}>
            <Card1 mb="1.5rem">
              <Typography fontWeight="600" fontSize="18px" mb="1rem">
                Items
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
                    {item.quantity} × {formatDisplayMoney(item.unitPrice)}
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
                Contact & shipping
              </Typography>
              <Typography fontWeight="500" mb="0.25rem">
                {contactName || contact.email}
              </Typography>
              <Typography color="text.muted" mb="1rem">
                {contact.email}
                {contact.phone ? ` · ${contact.phone}` : ""}
              </Typography>
              <Typography fontWeight="500" mb="0.25rem">
                Shipping address
              </Typography>
              <Typography color="text.muted" style={{ whiteSpace: "pre-line" }}>
                {shippingAddressText || "No shipping address provided"}
              </Typography>
            </Card1>

            <Card1>
              <Typography fontWeight="600" fontSize="18px" mb="0.5rem">
                Payment
              </Typography>
              <Typography color="text.muted">{paymentSummary}</Typography>
              {notes.trim().length > 0 && (
                <>
                  <Divider my="1rem" />
                  <Typography fontWeight="600" fontSize="16px" mb="0.5rem">
                    Delivery notes
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
              {isSubmitting ? "Placing order..." : "Place order"}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              mt="0.75rem"
              onClick={() => router.push("/payment")}>
              Back to payment
            </Button>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
