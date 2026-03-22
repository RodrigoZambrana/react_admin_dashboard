"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { extractApiErrorMessage } from "@/lib/api/errors";
import { buildCheckoutOrderItems } from "@/lib/checkout/order-items";
import { useCheckout } from "@/state/checkout-context";
import { useStorefrontCart } from "@/state/cart-context";
import { useCheckoutTotals } from "@/hooks/useCheckoutTotals";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useToast } from "@/contexts/ToastContext";
import { useI18n, useTranslation } from "@/state/i18n-context";
import { savePersistedCheckoutOrderItems } from "@/utils/checkoutStorage";
import MercadoPagoPaymentBrick, {
  type MercadoPagoPaymentSubmitPayload
} from "./MercadoPagoPaymentBrick";
import {
  isMercadoPagoPaymentConfirmed,
  MERCADO_PAGO_STATUS_DETAIL_MESSAGES,
  normalizeMercadoPagoStatus
} from "@/utils/mercadopago";
import { useCurrency } from "@/state/currency-context";

const MERCADO_PAGO_CURRENCY = "UYU";
const DEFAULT_MIN_INSTALLMENTS = 1;
const DEFAULT_MAX_INSTALLMENTS = 12;

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

const parseInstallmentsBound = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.floor(numeric);
};

const normalizeMessage = (value: unknown, fallback: string) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const text = String(value).trim();
  if (!text || text === "[object Object]") {
    return fallback;
  }
  return text;
};

const generateIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type PaymentMethod = "mercadopago" | "cod";

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const resolveSuccessFallback = () => "/payment/success";
const resolveFailureFallback = () => "/payment/error";

const normalizeRedirectTarget = (raw: string | null | undefined, fallback: string) => {
  if (raw === null || raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (isAbsoluteUrl(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed}`;
};

const appendQueryParams = (target: string, params: Record<string, string | null | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    const stringValue = String(value).trim();
    if (stringValue.length > 0) {
      query.set(key, stringValue);
    }
  });
  const queryString = query.toString();
  if (!queryString) {
    return target;
  }
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}${queryString}`;
};

const formatAmountForPreference = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 100) / 100;
};

const redirectWithParams = (
  target: string,
  params: Record<string, string | null | undefined>,
  router: ReturnType<typeof useRouter>
) => {
  const url = appendQueryParams(target, params);
  if (isAbsoluteUrl(target)) {
    window.location.assign(url);
    return;
  }
  router.push(url);
};

export default function PaymentForm() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslation();
  const { locale } = useI18n();
  const { convertMoney } = useCurrency();
  const { state: cartState } = useStorefrontCart();
  const { totals } = useCheckoutTotals();
  const storefrontConfig = useStorefrontConfig();
  const {
    contact,
    shippingAddress,
    shippingOption,
    fulfillmentMode,
    notes,
    hasDetails,
    payment,
    setPayment,
    clearPayment,
    checkoutToken
  } = useCheckout();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(() =>
    payment?.method === "mercadopago" ? "mercadopago" : "cod"
  );
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingPreference, setIsLoadingPreference] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preferenceReloadNonce, setPreferenceReloadNonce] = useState(0);
  const lastPreferenceKeyRef = useRef<string | null>(null);
  const [showMercadoPagoRecovery, setShowMercadoPagoRecovery] = useState(false);

  const translateMercadoPagoStatusMessage = useCallback(
    (status: string, detail?: string | null) => {
      const normalized = normalizeMercadoPagoStatus(status);
      switch (normalized) {
        case "approved":
          return t("checkout.payment.form.status.approved", {
            defaultMessage: "Payment approved. You can continue to confirm your order."
          });
        case "authorized":
          return t("checkout.payment.form.status.authorized", {
            defaultMessage:
              "Mercado Pago authorized the payment, but it is still pending final confirmation."
          });
        case "in_process":
        case "pending":
          return t("checkout.payment.form.status.pending", {
            defaultMessage:
              "Mercado Pago is reviewing your payment. Wait for confirmation before placing the order."
          });
        case "rejected":
          return detail && MERCADO_PAGO_STATUS_DETAIL_MESSAGES[detail]
            ? t(detail, {
                defaultMessage: MERCADO_PAGO_STATUS_DETAIL_MESSAGES[detail]
              })
            : t("checkout.payment.form.status.rejected", {
                defaultMessage:
                  "Your bank declined the transaction. Please verify the details or try another card."
              });
        case "processing":
        default:
          return t("checkout.payment.form.status.processing", {
            defaultMessage:
              "Processing payment with Mercado Pago. Wait for confirmation before placing the order."
          });
      }
    },
    [t]
  );

  const resetMercadoPagoSession = useCallback(
    (options?: { clearStoredPayment?: boolean }) => {
      if (options?.clearStoredPayment) {
        clearPayment();
      }
      setIsProcessingPayment(false);
      setPreferenceId(null);
      lastPreferenceKeyRef.current = null;
      setStatusMessage(null);
      setErrorMessage(null);
      setShowMercadoPagoRecovery(false);
      setPreferenceReloadNonce((value) => value + 1);
    },
    [clearPayment]
  );

  const retryPreferenceLoad = useCallback(() => {
    resetMercadoPagoSession();
  }, [resetMercadoPagoSession]);

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
      setStatusMessage(translateMercadoPagoStatusMessage(status, payment.statusDetail));
      setErrorMessage(null);
      setShowMercadoPagoRecovery(false);
    } else if (payment?.method === "cod") {
      setSelectedMethod("cod");
      setStatusMessage(null);
      setErrorMessage(null);
      setShowMercadoPagoRecovery(false);
    }
  }, [payment, translateMercadoPagoStatusMessage]);

  const mercadopagoConfig = storefrontConfig?.payments?.mercadopago ?? null;
  const publicKey =
    mercadopagoConfig?.publicKey ??
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ??
    "";
  const mpLocale = mapCountryToLocale(
    mercadopagoConfig?.country ?? process.env.NEXT_PUBLIC_MP_COUNTRY ?? "AR"
  );
  const isMercadoPagoEnabled =
    mercadopagoConfig?.enabled ?? (publicKey.trim().length > 0);
  const minInstallments = useMemo(() => {
    const configured = parseInstallmentsBound(mercadopagoConfig?.minInstallments ?? null);
    const fromEnv = parseInstallmentsBound(process.env.NEXT_PUBLIC_MP_MIN_INSTALLMENTS ?? null);
    return configured ?? fromEnv ?? DEFAULT_MIN_INSTALLMENTS;
  }, [mercadopagoConfig?.minInstallments]);
  const maxInstallments = useMemo(() => {
    const configured = parseInstallmentsBound(mercadopagoConfig?.maxInstallments ?? null);
    const fromEnv = parseInstallmentsBound(process.env.NEXT_PUBLIC_MP_MAX_INSTALLMENTS ?? null);
    const resolved = configured ?? fromEnv ?? DEFAULT_MAX_INSTALLMENTS;
    return Math.max(resolved, minInstallments);
  }, [mercadopagoConfig?.maxInstallments, minInstallments]);

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

  const payerInfo = useMemo(
    () => ({
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName
    }),
    [contact.email, contact.firstName, contact.lastName]
  );

  const cartId = useMemo(() => `cart-${cartState.updatedAt}`, [cartState.updatedAt]);
  const { amount, currency } = useMemo(() => {
    const converted = convertMoney(totals.total, MERCADO_PAGO_CURRENCY);
    const roundedAmount = Number.isFinite(converted.amount)
      ? Math.round(converted.amount * 100) / 100
      : 0;
    const resolvedCurrency = converted.currency ?? MERCADO_PAGO_CURRENCY;
    return {
      amount: roundedAmount,
      currency: resolvedCurrency
    };
  }, [convertMoney, totals.total]);
  const orderItemsSnapshot = useMemo(() => buildCheckoutOrderItems(cartState.items), [cartState.items]);
  const checkoutSnapshot = useMemo(() => {
    if (!shippingOption?.id || orderItemsSnapshot.items.length === 0 || orderItemsSnapshot.error) {
      return undefined;
    }

    return {
      customer: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone && contact.phone.length > 0 ? contact.phone : undefined,
        locale
      },
      shippingAddress: {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || undefined,
        city: shippingAddress.city,
        state: shippingAddress.state || undefined,
        zip: shippingAddress.zip || undefined,
        country: shippingAddress.country
      },
      items: orderItemsSnapshot.items,
      notes: notes && notes.trim().length > 0 ? notes.trim() : undefined,
      shippingOptionId: shippingOption.id,
      fulfillmentMode,
      currency
    };
  }, [
    contact.email,
    contact.firstName,
    contact.lastName,
    contact.phone,
    currency,
    fulfillmentMode,
    locale,
    notes,
    orderItemsSnapshot.error,
    orderItemsSnapshot.items,
    shippingAddress.city,
    shippingAddress.country,
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.state,
    shippingAddress.zip,
    shippingOption?.id
  ]);

  useEffect(() => {
    if (!checkoutToken || orderItemsSnapshot.items.length === 0 || orderItemsSnapshot.error) {
      return;
    }
    savePersistedCheckoutOrderItems(checkoutToken, orderItemsSnapshot.items);
  }, [checkoutToken, orderItemsSnapshot]);

  const hasPublicKey = publicKey.trim().length > 0;
  const checkoutItemsError = orderItemsSnapshot.error;
  const canRenderBrick =
    isMercadoPagoEnabled &&
    hasPublicKey &&
    amount > 0 &&
    orderItemsSnapshot.items.length > 0 &&
    !checkoutItemsError;

  const handleProcessingChange = useCallback(
    (processing: boolean) => {
      setIsProcessingPayment(processing);
      if (processing) {
        setStatusMessage(
          t("checkout.payment.form.status.processing", {
            defaultMessage:
              "Processing payment with Mercado Pago. Wait for confirmation before placing the order."
          })
        );
        setErrorMessage(null);
      }
    },
    [t]
  );

  const successRedirectTarget = useMemo(() => {
    const fallback = resolveSuccessFallback();
    return normalizeRedirectTarget(process.env.NEXT_PUBLIC_MP_SUCCESS_URL ?? null, fallback);
  }, []);

  const failureRedirectTarget = useMemo(() => {
    const fallback = resolveFailureFallback();
    return normalizeRedirectTarget(process.env.NEXT_PUBLIC_MP_FAILURE_URL ?? null, fallback);
  }, []);

  useEffect(() => {
    if (!canRenderBrick || selectedMethod !== "mercadopago") {
      setPreferenceId(null);
      lastPreferenceKeyRef.current = null;
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage(
        t("checkout.payment.form.errors.invalidAmount", {
          defaultMessage: "The payment amount is invalid for Mercado Pago."
        })
      );
      setPreferenceId(null);
      lastPreferenceKeyRef.current = null;
      return;
    }

    const normalizedAmount = formatAmountForPreference(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setErrorMessage(
        t("checkout.payment.form.errors.invalidAmount", {
          defaultMessage: "The payment amount is invalid for Mercado Pago."
        })
      );
      setPreferenceId(null);
      lastPreferenceKeyRef.current = null;
      return;
    }

    // Debug: verify what we send to preference endpoint
    // eslint-disable-next-line no-console
    console.log("MP pref request", {
      amount,
      currency,
      normalized: normalizedAmount,
      totals: totals.total
    });

    const preferenceKey = [
      amount,
      currency,
      description,
      cartId,
      contact.email,
      maxInstallments,
      statementDescriptor,
      successRedirectTarget,
      failureRedirectTarget
    ].join("|");

    if (preferenceId && lastPreferenceKeyRef.current === preferenceKey) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof window.setTimeout> | null = null;
    const maxRetryAttempts = 2;

    const fetchPreference = async (attempt = 0) => {
      setIsLoadingPreference(true);
      try {
        const response = await StorefrontApi.createMercadoPagoPreference({
          amount: normalizedAmount,
          currency,
          description,
          cartId,
          checkoutToken,
          statementDescriptor,
          payerEmail: contact.email,
          successUrl: successRedirectTarget,
          failureUrl: failureRedirectTarget,
          pendingUrl: failureRedirectTarget,
          minInstallments,
          maxInstallments,
          checkoutSnapshot
        });
        if (cancelled) return;
        setPreferenceId(response.preferenceId);
        lastPreferenceKeyRef.current = preferenceKey;
        setErrorMessage(null);
        setIsLoadingPreference(false);
      } catch (cause) {
        if (cancelled) return;
        if (attempt < maxRetryAttempts) {
          retryTimer = window.setTimeout(() => {
            void fetchPreference(attempt + 1);
          }, 600 * (attempt + 1));
          return;
        }
        const message = isApiError(cause)
          ? normalizeMessage(
              extractApiErrorMessage(cause),
              t("checkout.payment.form.errors.initializePreference", {
                defaultMessage: "We couldn't initialize Mercado Pago. Please try again."
              })
            )
          : cause instanceof Error
            ? cause.message
            : t("checkout.payment.form.errors.initializePreference", {
                defaultMessage: "We couldn't initialize Mercado Pago. Please try again."
              });
        setPreferenceId(null);
        lastPreferenceKeyRef.current = null;
        setErrorMessage(
          normalizeMessage(
            message,
            t("checkout.payment.form.errors.initializePreference", {
              defaultMessage: "We couldn't initialize Mercado Pago. Please try again."
            })
          )
        );
        setIsLoadingPreference(false);
      }
    };
    void fetchPreference();
    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    amount,
    canRenderBrick,
    cartId,
    contact.email,
    currency,
    description,
    failureRedirectTarget,
    maxInstallments,
    minInstallments,
    preferenceReloadNonce,
    preferenceId,
    selectedMethod,
    successRedirectTarget,
    statementDescriptor,
    checkoutToken,
    checkoutSnapshot,
    t,
    totals.total
  ]);

  const handleMercadoPagoSubmit = useCallback(
    async (
      cardData: MercadoPagoPaymentSubmitPayload
    ): Promise<{ status: "success" | "pending" | "error"; paymentId?: string | null; statusDetail?: string | null }> => {
      setErrorMessage(null);
      setStatusMessage(
        t("checkout.payment.form.status.processing", {
          defaultMessage:
            "Processing payment with Mercado Pago. Wait for confirmation before placing the order."
        })
      );
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
            checkoutToken,
            statementDescriptor,
            checkoutSnapshot
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
          checkoutSnapshot: response.checkoutSnapshot ?? checkoutSnapshot,
          updatedAt: response.createdAt ?? new Date().toISOString()
        };

        setPayment(checkoutPayment);
        const statusText = translateMercadoPagoStatusMessage(
          normalizedStatus,
          checkoutPayment.statusDetail
        );
        setStatusMessage(statusText);
        setErrorMessage(null);

        const redirectParams = {
          paymentId: checkoutPayment.paymentId ?? checkoutPayment.paymentIntentId ?? null,
          status: normalizedStatus,
          detail: checkoutPayment.statusDetail ?? null
        };

        if (isMercadoPagoPaymentConfirmed(normalizedStatus)) {
          toast.success({
            title: t("checkout.payment.form.toast.approved.title", {
              defaultMessage: "Payment approved"
            }),
            description: t("checkout.payment.form.toast.approved.description", {
              defaultMessage: "Mercado Pago accepted your card."
            })
          });
          redirectWithParams(successRedirectTarget, redirectParams, router);
        } else if (normalizedStatus === "in_process" || normalizedStatus === "pending") {
          toast.info({
            title: t("checkout.payment.form.toast.pending.title", {
              defaultMessage: "Payment under review"
            }),
            description: t("checkout.payment.form.status.pending", {
              defaultMessage:
                "Mercado Pago is reviewing your payment. Wait for confirmation before placing the order."
            })
          });
        } else if (normalizedStatus === "rejected") {
          clearPayment();
          toast.error({
            title: t("checkout.payment.form.toast.rejected.title", {
              defaultMessage: "Payment rejected"
            }),
            description:
              checkoutPayment.statusDetail && MERCADO_PAGO_STATUS_DETAIL_MESSAGES[checkoutPayment.statusDetail]
                ? t(checkoutPayment.statusDetail, {
                    defaultMessage: MERCADO_PAGO_STATUS_DETAIL_MESSAGES[checkoutPayment.statusDetail]
                  })
                : t("checkout.payment.form.status.rejected", {
                    defaultMessage:
                      "Your bank declined the transaction. Please verify the details or try another card."
                  })
          });
          redirectWithParams(failureRedirectTarget, redirectParams, router);
        }

        const brickStatus = isMercadoPagoPaymentConfirmed(normalizedStatus)
          ? "success"
          : normalizedStatus === "authorized" ||
              normalizedStatus === "in_process" ||
              normalizedStatus === "pending"
            ? "pending"
            : "error";

        return {
          status: brickStatus,
          paymentId: response.paymentId ?? response.paymentIntentId ?? null,
          statusDetail: response.statusDetail ?? null
        };
      } catch (cause) {
        const message = isApiError(cause)
          ? extractApiErrorMessage(cause)
          : cause instanceof Error
            ? cause.message
            : t("checkout.payment.form.errors.processFailed", {
                defaultMessage: "We couldn't process your payment. Please try again."
              });
        setErrorMessage(
          normalizeMessage(
            message,
            t("checkout.payment.form.errors.processFailed", {
              defaultMessage: "We couldn't process your payment. Please try again."
            })
          )
        );
        setStatusMessage(null);
        clearPayment();
        toast.error({
          title: t("checkout.payment.form.toast.processFailed.title", {
            defaultMessage: "We couldn't process the payment"
          }),
          description: normalizeMessage(
            message,
            t("checkout.payment.form.errors.processFailed", {
              defaultMessage: "We couldn't process your payment. Please try again."
            })
          )
        });
        redirectWithParams(
          failureRedirectTarget,
          {
            paymentId: null,
            status: "error",
            detail: message
          },
          router
        );
        throw cause;
      }
    },
    [
      amount,
      cartId,
      checkoutSnapshot,
      checkoutToken,
      clearPayment,
      currency,
      description,
      failureRedirectTarget,
      payerName,
      router,
      setPayment,
      statementDescriptor,
      successRedirectTarget,
      toast
      ,
      translateMercadoPagoStatusMessage,
      t
    ]
  );

  const handleMethodChange = useCallback(
    (method: PaymentMethod) => {
      setSelectedMethod(method);
      setErrorMessage(null);
      setStatusMessage(null);
      setShowMercadoPagoRecovery(false);
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
    return isMercadoPagoPaymentConfirmed(payment.status);
  }, [payment, selectedMethod]);

  useEffect(() => {
    if (selectedMethod !== "mercadopago") {
      setShowMercadoPagoRecovery(false);
      return;
    }

    const paymentConfirmed =
      payment?.method === "mercadopago" && isMercadoPagoPaymentConfirmed(payment.status);

    if (paymentConfirmed || !preferenceId) {
      setShowMercadoPagoRecovery(false);
      return;
    }

    let wentToBackground = false;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wentToBackground = true;
        return;
      }

      if (wentToBackground && document.visibilityState === "visible") {
        setShowMercadoPagoRecovery(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [payment, preferenceId, selectedMethod]);

  const handleContinue = useCallback(() => {
    if (selectedMethod === "cod") {
      setPayment({ method: "cod" });
      router.push("/review");
      return;
    }

    if (!payment || payment.method !== "mercadopago") {
      const message = t("checkout.payment.form.errors.mustProcessBeforeContinue", {
        defaultMessage: "Process your payment with Mercado Pago before continuing."
      });
      setErrorMessage(message);
      toast.error({
        title: t("checkout.payment.form.toast.paymentRequired.title", {
          defaultMessage: "Payment required"
        }),
        description: message
      });
      return;
    }

    const status = normalizeMercadoPagoStatus(payment.status);

    if (isMercadoPagoPaymentConfirmed(status)) {
      router.push("/review");
      return;
    }

    if (status === "processing") {
      toast.info({
        title: t("checkout.payment.form.toast.processing.title", {
          defaultMessage: "Payment in progress"
        }),
        description: t("checkout.payment.form.toast.processing.description", {
          defaultMessage: "Please wait while Mercado Pago completes the payment."
        })
      });
      return;
    }

    if (status === "rejected") {
      toast.error({
        title: t("checkout.payment.form.toast.rejected.title", {
          defaultMessage: "Payment rejected"
        }),
        description: t("checkout.payment.form.status.rejected", {
          defaultMessage: "Your bank declined the transaction. Please verify the details or try another card."
        })
      });
      return;
    }

    toast.info({
      title: t("checkout.payment.form.toast.pending.title", {
        defaultMessage: "Payment under review"
      }),
      description: t("checkout.payment.form.status.pending", {
        defaultMessage:
          "Mercado Pago is reviewing your payment. Wait for confirmation before placing the order."
      })
    });
  }, [payment, router, selectedMethod, setPayment, t, toast]);

  const mpUnavailableMessage = checkoutItemsError
    ? checkoutItemsError
    : !isMercadoPagoEnabled
    ? t("checkout.payment.form.unavailable.notConfigured", {
        defaultMessage: "Mercado Pago is not configured. Update the credentials in Settings → Mercado Pago."
      })
    : amount <= 0
      ? t("checkout.payment.form.unavailable.emptyCart", {
          defaultMessage: "Add products to your cart to enable Mercado Pago payments."
        })
      : null;
  const paymentButtonBlocked =
    selectedMethod === "mercadopago" &&
    (Boolean(mpUnavailableMessage) || isLoadingPreference || !preferenceId);

  return (
    <Box>
      <Card1 mb="2rem">
        <Typography fontWeight="600" mb="1rem">
          {t("checkout.payment.form.methodTitle", { defaultMessage: "Payment method" })}
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
              {t("checkout.payment.form.method.mercadopago", {
                defaultMessage: "Pay with card (Mercado Pago)"
              })}
            </Typography>
          }
        />

        {selectedMethod === "mercadopago" && (
          <Box mt="1rem">
            {mpUnavailableMessage ? (
              <Typography color="error.main" fontSize="14px">
                {mpUnavailableMessage}
              </Typography>
            ) : isLoadingPreference ? (
              <Typography color="text.muted" fontSize="14px">
                {t("checkout.payment.form.loadingPreference", {
                  defaultMessage: "Preparing Mercado Pago checkout..."
                })}
              </Typography>
            ) : !preferenceId ? (
              <Box>
                <Typography color="error.main" fontSize="14px">
                  {errorMessage ??
                    t("checkout.payment.form.errors.initializePreference", {
                      defaultMessage: "We couldn't initialize Mercado Pago. Please try again."
                    })}
                </Typography>
                <Box mt="0.75rem">
                  <Button size="sm" variant="outlined" onClick={retryPreferenceLoad}>
                    {t("checkout.payment.form.actions.retryMercadoPago", {
                      defaultMessage: "Retry Mercado Pago"
                    })}
                  </Button>
                </Box>
              </Box>
            ) : (
              <MercadoPagoPaymentBrick
                publicKey={publicKey}
                locale={mpLocale}
                amount={amount}
                currency={currency}
                preferenceId={preferenceId}
                minInstallments={minInstallments}
                maxInstallments={maxInstallments}
                payer={payerInfo}
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
            {showMercadoPagoRecovery && !isLoadingPreference && preferenceId && (
              <Box mt="0.75rem">
                <Typography color="text.muted" fontSize="14px">
                  {t("checkout.payment.form.recovery.walletHint", {
                    defaultMessage:
                      "If you closed Mercado Pago Wallet and want to try again, restart the payment form."
                  })}
                </Typography>
                <Box mt="0.5rem">
                  <Button
                    size="sm"
                    variant="outlined"
                    onClick={() => resetMercadoPagoSession({ clearStoredPayment: true })}
                  >
                    {t("checkout.payment.form.actions.restartMercadoPago", {
                      defaultMessage: "Restart Mercado Pago"
                    })}
                  </Button>
                </Box>
              </Box>
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
              {t("checkout.payment.form.method.cod", {
                defaultMessage: "Cash on delivery"
              })}
            </Typography>
          }
        />

        <Typography color="text.muted" fontSize="14px" mt="0.5rem">
          {t("checkout.payment.form.method.codHelp", {
            defaultMessage: "You'll pay with cash or card when the order is delivered."
          })}
        </Typography>
      </Card1>

      <Grid container spacing={7}>
        <Grid item sm={6} xs={12}>
          <Link href="/checkout">
            <Button variant="outlined" color="primary" type="button" fullWidth>
              {t("checkout.payment.form.actions.backToDetails", {
                defaultMessage: "Back to details"
              })}
            </Button>
          </Link>
        </Grid>

        <Grid item sm={6} xs={12}>
          <Button
            variant="contained"
            color="primary"
            type="button"
            fullWidth
            disabled={isProcessingPayment || !canProceedToReview || paymentButtonBlocked}
            onClick={handleContinue}
          >
            {selectedMethod === "cod"
              ? t("checkout.payment.form.actions.reviewOrder", {
                  defaultMessage: "Review order"
                })
              : isProcessingPayment
                ? t("checkout.payment.form.actions.processing", {
                    defaultMessage: "Processing..."
                  })
                : t("checkout.payment.form.actions.reviewOrder", {
                    defaultMessage: "Review order"
                  })}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
