"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Box from "@component/Box";
import Radio from "@component/radio";
import Grid from "@component/grid/Grid";
import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import { Button } from "@component/buttons";
import Typography from "@component/Typography";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { useCheckout } from "@/state/checkout-context";
import { useStorefrontCart } from "@/state/cart-context";
import { useCheckoutTotals } from "@/hooks/useCheckoutTotals";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useToast } from "@/contexts/ToastContext";
import MercadoPagoCardBrick, {
  type MercadoPagoCardSubmitPayload
} from "./MercadoPagoCardBrick";
import {
  buildMercadoPagoStatusMessage,
  MERCADO_PAGO_STATUS_DETAIL_MESSAGES,
  normalizeMercadoPagoStatus
} from "@/utils/mercadopago";

const COUNTRY_LOCALE_MAP: Record<string, string> = {
  AR: "es-AR",
  BR: "pt-BR",
  CL: "es-CL",
  CO: "es-CO",
  MX: "es-MX",
  PE: "es-PE",
  UY: "es-UY",
  US: "en-US"
};

const mapCountryToLocale = (country?: string) => {
  if (!country) return COUNTRY_LOCALE_MAP.AR;
  const normalized = country.trim().toUpperCase();
  return COUNTRY_LOCALE_MAP[normalized] ?? COUNTRY_LOCALE_MAP.AR;
};

const generateIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type PaymentMethod = "mercadopago" | "cod";

export default function PaymentForm() {
  const router = useRouter();
  const toast = useToast();
  const { state: cartState } = useStorefrontCart();
  const { totals } = useCheckoutTotals();
  const storefrontConfig = useStorefrontConfig();
  const {
    contact,
    hasDetails,
    payment,
    setPayment,
    clearPayment
  } = useCheckout();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(() =>
    payment?.method === "cod" ? "cod" : "mercadopago"
  );
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cartState.items.length === 0) {
      router.replace("/cart");
    }
  }, [cartState.items.length, router]);

  useEffect(() => {
    if (!hasDetails) {
      router.replace("/checkout");
    }
  }, [hasDetails, router]);

  useEffect(() => {
    if (payment?.method === "mercadopago") {
      const status = normalizeMercadoPagoStatus(payment.status);
      setSelectedMethod("mercadopago");
      setStatusMessage(buildMercadoPagoStatusMessage(status, payment.statusDetail));
      setErrorMessage(null);
    } else if (payment?.method === "cod") {
      setSelectedMethod("cod");
      setStatusMessage(null);
      setErrorMessage(null);
    }
  }, [payment]);

  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";
  const locale = mapCountryToLocale(process.env.NEXT_PUBLIC_MP_COUNTRY ?? "AR");

  const companyName = useMemo(() => {
    const profile = storefrontConfig?.companyProfile;
    const candidate = profile?.tradeName ?? profile?.legalName ?? "Storefront";
    return candidate.trim().length > 0 ? candidate.trim() : "Storefront";
  }, [storefrontConfig]);

  const statementDescriptor = useMemo(() => {
    const sanitized = companyName.replace(/[^A-Za-z0-9\s]/g, "");
    return sanitized.slice(0, 22).toUpperCase();
  }, [companyName]);

  const description = useMemo(() => `Order payment · ${companyName}`, [companyName]);

  const payerName = useMemo(
    () => [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim(),
    [contact.firstName, contact.lastName]
  );

  const cartId = useMemo(() => `cart-${cartState.updatedAt}`, [cartState.updatedAt]);
  const amount = totals.total.amount;
  const currency = totals.total.currency;

  const canRenderBrick = publicKey.length > 0 && amount > 0;

  const handleProcessingChange = useCallback(
    (processing: boolean) => {
      setIsProcessingPayment(processing);
      if (processing) {
        setStatusMessage("Processing payment with Mercado Pago...");
        setErrorMessage(null);
      }
    },
    []
  );

  const handleMercadoPagoSubmit = useCallback(
    async (
      cardData: MercadoPagoCardSubmitPayload
    ): Promise<{ status: "success" | "pending" | "error"; paymentId?: string | null; statusDetail?: string | null }> => {
      setErrorMessage(null);
      setStatusMessage("Processing payment with Mercado Pago...");
      const idempotencyKey = generateIdempotencyKey();

      try {
        const response = await StorefrontApi.createMercadoPagoCharge(
          {
            token: cardData.token,
            transactionAmount: amount,
            currency,
            installments: cardData.installments,
            paymentMethodId: cardData.paymentMethodId,
            payer: {
              email: cardData.payer.email,
              identification: cardData.payer.identification,
              firstName: cardData.payer.firstName,
              lastName: cardData.payer.lastName
            },
            issuerId: cardData.issuerId,
            description,
            orderId: undefined,
            cartId,
            statementDescriptor
          },
          { idempotencyKey }
        );

        const normalizedStatus = normalizeMercadoPagoStatus(response.status);
        const checkoutPayment = {
          method: "mercadopago" as const,
          paymentIntentId: response.paymentIntentId,
          paymentId: response.paymentId ?? undefined,
          status: normalizedStatus,
          statusDetail: response.statusDetail ?? undefined,
          currency: response.currency ?? currency,
          amount: response.amount ?? amount,
          installments: response.installments ?? undefined,
          cardBrand: response.cardBrand ?? undefined,
          cardLastFour: response.cardLastFour ?? undefined,
          cardholderName: response.cardholderName ?? payerName,
          updatedAt: response.createdAt ?? new Date().toISOString()
        };

        setPayment(checkoutPayment);
        const statusText = buildMercadoPagoStatusMessage(normalizedStatus, checkoutPayment.statusDetail);
        setStatusMessage(statusText);
        setErrorMessage(null);

        if (normalizedStatus === "approved" || normalizedStatus === "authorized") {
          toast.success({
            title: "Payment approved",
            description: "Mercado Pago accepted your card."
          });
        } else if (normalizedStatus === "in_process" || normalizedStatus === "pending") {
          toast.info({
            title: "Payment under review",
            description: "Mercado Pago is reviewing your payment. You can continue with your order."
          });
        } else if (normalizedStatus === "rejected") {
          toast.error({
            title: "Payment rejected",
            description:
              checkoutPayment.statusDetail && MERCADO_PAGO_STATUS_DETAIL_MESSAGES[checkoutPayment.statusDetail]
                ? MERCADO_PAGO_STATUS_DETAIL_MESSAGES[checkoutPayment.statusDetail]
                : "Your bank declined the transaction. Please review the details and try again."
          });
        }

        const brickStatus =
          normalizedStatus === "approved" || normalizedStatus === "authorized"
            ? "success"
            : normalizedStatus === "in_process" || normalizedStatus === "pending"
              ? "pending"
              : "error";

        return {
          status: brickStatus,
          paymentId: response.paymentId ?? response.paymentIntentId ?? null,
          statusDetail: response.statusDetail ?? null
        };
      } catch (cause) {
        const message = isApiError(cause)
          ? cause.payload?.message ?? cause.message
          : cause instanceof Error
            ? cause.message
            : "We couldn't process your payment. Please try again.";
        setErrorMessage(message);
        setStatusMessage(null);
        clearPayment();
        toast.error({
          title: "We couldn't process the payment",
          description: message
        });
        throw cause;
      }
    },
    [amount, cartId, clearPayment, currency, description, payerName, setPayment, statementDescriptor, toast]
  );

  const handleMethodChange = useCallback(
    (method: PaymentMethod) => {
      setSelectedMethod(method);
      setErrorMessage(null);
      setStatusMessage(null);
      if (method === "cod") {
        setPayment({ method: "cod" });
      } else if (payment?.method === "cod") {
        clearPayment();
      }
    },
    [clearPayment, payment?.method, setPayment]
  );

  const canProceedToReview = useMemo(() => {
    if (selectedMethod === "cod") {
      return true;
    }
    if (!payment || payment.method !== "mercadopago") {
      return false;
    }
    if (!payment.paymentIntentId) {
      return false;
    }
    const status = normalizeMercadoPagoStatus(payment.status);
    return status !== "rejected" && status !== "processing";
  }, [payment, selectedMethod]);

  const handleContinue = useCallback(() => {
    if (selectedMethod === "cod") {
      setPayment({ method: "cod" });
      router.push("/review");
      return;
    }

    if (!payment || payment.method !== "mercadopago") {
      const message = "Process your payment with Mercado Pago before continuing.";
      setErrorMessage(message);
      toast.error({ title: "Payment required", description: message });
      return;
    }

    const status = normalizeMercadoPagoStatus(payment.status);

    if (status === "processing") {
      toast.info({
        title: "Payment in progress",
        description: "Please wait while Mercado Pago completes the payment."
      });
      return;
    }

    if (status === "rejected") {
      toast.error({
        title: "Payment rejected",
        description: "Your bank declined the transaction. Try again with another card."
      });
      return;
    }

    router.push("/review");
  }, [payment, router, selectedMethod, setPayment, toast]);

  const mpUnavailableMessage = !publicKey
    ? "Mercado Pago public key is not configured. Add NEXT_PUBLIC_MP_PUBLIC_KEY to your environment."
    : amount <= 0
      ? "Add products to your cart to enable Mercado Pago payments."
      : null;

  return (
    <Box>
      <Card1 mb="2rem">
        <Typography fontWeight="600" mb="1rem">
          Payment method
        </Typography>

        <Radio
          mb="1.25rem"
          color="secondary"
          name="paymentMethod"
          value="mercadopago"
          onChange={(event) => handleMethodChange(event.target.value as PaymentMethod)}
          checked={selectedMethod === "mercadopago"}
          label={
            <Typography ml="6px" fontWeight="600" fontSize="18px">
              Pay with card (Mercado Pago)
            </Typography>
          }
        />

        {selectedMethod === "mercadopago" && (
          <Box mt="1rem">
            {mpUnavailableMessage ? (
              <Typography color="error.main" fontSize="14px">
                {mpUnavailableMessage}
              </Typography>
            ) : (
              <MercadoPagoCardBrick
                publicKey={publicKey}
                locale={locale}
                amount={amount}
                currency={currency}
                payer={{
                  email: contact.email,
                  firstName: contact.firstName,
                  lastName: contact.lastName
                }}
                description={description}
                onSubmit={handleMercadoPagoSubmit}
                onProcessingChange={handleProcessingChange}
                onError={setErrorMessage}
              />
            )}
            {statusMessage && (
              <Typography color="primary.main" fontSize="14px" mt="0.75rem">
                {statusMessage}
              </Typography>
            )}
            {errorMessage && (
              <Typography color="error.main" fontSize="14px" mt="0.75rem">
                {errorMessage}
              </Typography>
            )}
          </Box>
        )}

        <Divider mb="1.5rem" mx="-2rem" />

        <Radio
          color="secondary"
          name="paymentMethod"
          value="cod"
          onChange={(event) => handleMethodChange(event.target.value as PaymentMethod)}
          checked={selectedMethod === "cod"}
          label={
            <Typography ml="6px" fontWeight="600" fontSize="18px">
              Cash on delivery
            </Typography>
          }
        />

        <Typography color="text.muted" fontSize="14px" mt="0.5rem">
          You&apos;ll pay with cash or card when the order is delivered.
        </Typography>
      </Card1>

      <Grid container spacing={7}>
        <Grid item sm={6} xs={12}>
          <Link href="/checkout">
            <Button variant="outlined" color="primary" type="button" fullWidth>
              Back to details
            </Button>
          </Link>
        </Grid>

        <Grid item sm={6} xs={12}>
          <Button
            variant="contained"
            color="primary"
            type="button"
            fullWidth
            disabled={isProcessingPayment || !canProceedToReview || Boolean(mpUnavailableMessage && selectedMethod === "mercadopago")}
            onClick={handleContinue}
          >
            {selectedMethod === "cod"
              ? "Review order"
              : isProcessingPayment
                ? "Processing..."
                : "Review order"}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
