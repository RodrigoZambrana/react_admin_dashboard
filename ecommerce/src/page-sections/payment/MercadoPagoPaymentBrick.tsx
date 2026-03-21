"use client";

import { useEffect, useRef, useState } from "react";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";
import { formatCurrencyAmount } from "@/lib/currency/utils";
import { resolveCurrencyLocale } from "@/lib/currency/locale";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const SECURITY_SCRIPT_URL = "https://www.mercadopago.com/v2/security.js";
const SCRIPT_ID = "mercado-pago-sdk";
const SECURITY_SCRIPT_ID = "mercado-pago-security";
const BRICK_CONTAINER_ID = "mp-payment-brick";

export type MercadoPagoPaymentSubmitPayload = {
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string;
  payer: {
    email: string;
    identification: { type: string; number: string };
    firstName?: string;
    lastName?: string;
  };
};

type BrickSubmitResult = {
  status: "success" | "pending" | "error";
  paymentId?: string | null;
  statusDetail?: string | null;
  errorMessage?: string | null;
};

interface MercadoPagoPaymentBrickProps {
  publicKey: string;
  locale: string;
  amount: number;
  currency: string;
  preferenceId: string;
  minInstallments?: number;
  maxInstallments?: number;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  description?: string;
  onSubmit: (payload: MercadoPagoPaymentSubmitPayload) => Promise<BrickSubmitResult>;
  onProcessingChange?: (processing: boolean) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

type CardPaymentFormData = {
  token: string;
  payment_method_id: string;
  payment_id?: string | null;
  installments?: number | string;
  issuer_id?: string;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
    first_name?: string;
    last_name?: string;
  };
};

type SubmitActions = {
  submitComplete?: (result: BrickSubmitResult) => void;
  resolve?: (payload?: unknown) => void;
  reject?: (reason?: unknown) => void;
};

type MercadoPagoBrickController = {
  destroy?: () => void;
  unmount?: () => void;
  update?: (settings: Record<string, unknown>) => Promise<void>;
};

type SubmitEventArg =
  | CardPaymentFormData
  | {
      formData: CardPaymentFormData;
      actions?: SubmitActions;
      selectedPaymentMethod?: unknown;
    }
  | {
      formData: CardPaymentFormData;
      selectedPaymentMethod?: unknown;
    };

const loadScript = (id: string, src: string, target: "head" | "body" = "body") =>
  new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Mercado Pago scripts can only be loaded in the browser."));
      return;
    }

    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}.`));
    (target === "head" ? document.head : document.body).appendChild(script);
  });

const initializeMercadoPago = async (publicKey: string, locale: string) => {
  if (typeof window === "undefined") {
    throw new Error("Mercado Pago SDK requires a browser environment.");
  }

  await loadScript(SCRIPT_ID, SDK_URL, "head");

  if (typeof window.MercadoPago !== "function") {
    throw new Error("Mercado Pago SDK is not available on window.");
  }

  return new window.MercadoPago(publicKey, { locale });
};

const ensureSecurityScript = async () => {
  await loadScript(SECURITY_SCRIPT_ID, SECURITY_SCRIPT_URL, "body");
  if (typeof document !== "undefined") {
    const script = document.getElementById(SECURITY_SCRIPT_ID);
    script?.setAttribute("view", "checkout");
  }
};

const ensureIdentification = (
  source: CardPaymentFormData["payer"],
  defaults: { firstName?: string; lastName?: string }
) => {
  const identification = source?.identification ?? {};
  const type = identification.type && identification.type.trim().length > 0 ? identification.type : "DNI";
  const number =
    identification.number && identification.number.trim().length > 0 ? identification.number : "00000000";
  return {
    type,
    number,
    firstName: source?.first_name ?? defaults.firstName,
    lastName: source?.last_name ?? defaults.lastName
  };
};

const parseInstallmentBound = (value?: number): number | null => {
  if (typeof value !== "number") {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
};

const sanitizeInstallments = (value: number | string | undefined, min: number, max: number): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return min;
  }
  const normalized = Math.floor(parsed);
  if (normalized < min) {
    return min;
  }
  if (normalized > max) {
    return max;
  }
  return normalized;
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const destroyController = (controller: MercadoPagoBrickController | null) => {
  if (!controller) return;
  if (typeof controller.destroy === "function") {
    controller.destroy();
    return;
  }
  if (typeof controller.unmount === "function") {
    controller.unmount();
  }
};

const extractFormData = (event: SubmitEventArg): CardPaymentFormData | null => {
  if (!event) return null;

  if ("formData" in event) {
    return event.formData ?? null;
  }

  return event;
};

const extractActions = (event: SubmitEventArg): SubmitActions | undefined => {
  if (event && typeof event === "object" && "actions" in event && event.actions) {
    return event.actions;
  }
  return undefined;
};

const notifyActions = (result: BrickSubmitResult, actions?: SubmitActions, error?: unknown) => {
  if (!actions) return;
  actions.submitComplete?.(result);
  if (result.status === "success" || result.status === "pending") {
    actions.resolve?.(result);
  } else {
    actions.reject?.(error ?? result);
  }
};

export default function MercadoPagoPaymentBrick({
  publicKey,
  locale,
  amount,
  currency,
  preferenceId,
  payer,
  description,
  minInstallments = 1,
  maxInstallments = 12,
  onSubmit,
  onProcessingChange,
  onReady,
  onError
}: MercadoPagoPaymentBrickProps) {
  const controllerRef = useRef<MercadoPagoBrickController | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizedMinInstallments = parseInstallmentBound(minInstallments) ?? 1;
  const normalizedMaxInstallments =
    Math.max(normalizedMinInstallments, parseInstallmentBound(maxInstallments) ?? normalizedMinInstallments);

  useEffect(() => {
    let cancelled = false;

    const mountBrick = async () => {
      try {
        if (amount <= 0) {
          setLoading(false);
          onError?.("Payment amount must be greater than zero to initialize Mercado Pago.");
          return;
        }

        if (!preferenceId) {
          setLoading(false);
          onError?.("Missing Mercado Pago preference to initialize the payment brick.");
          return;
        }

        setLoading(true);
        const sdk = await initializeMercadoPago(publicKey, locale);
        await ensureSecurityScript();
        if (cancelled) return;

        destroyController(controllerRef.current);
        controllerRef.current = null;

        const bricksBuilder = sdk.bricks();
        const settings = {
          initialization: {
            amount,
            preferenceId,
            payer: {
              email: payer.email,
              firstName: payer.firstName,
              lastName: payer.lastName
            },
            description
          },
          customization: {
            visual: {
              style: {
                theme: "default"
              },
              defaultPaymentOption: {
                walletForm: true
              }
            },
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              bankTransfer: "all",
              ticket: "all",
              mercadoPago: "all",
              minInstallments: normalizedMinInstallments,
              maxInstallments: normalizedMaxInstallments,
              installments: {
                min: normalizedMinInstallments,
                max: normalizedMaxInstallments
              }
            }
          },
          callbacks: {
            onReady: () => {
              if (cancelled) {
                return;
              }
              setLoading(false);
              onReady?.();
            },
            onSubmit: async (event: SubmitEventArg) => {
              const formData = extractFormData(event);
              const actions = extractActions(event);
              const hasCardToken = Boolean(formData?.token && formData.payment_method_id);

              if (!hasCardToken) {
                const success: BrickSubmitResult = {
                  status: "success",
                  paymentId: formData?.payment_id ?? null,
                  statusDetail: null,
                  errorMessage: null
                };
                notifyActions(success, actions);
                return success;
              }

              const identification = ensureIdentification(formData?.payer, {
                firstName: payer.firstName,
                lastName: payer.lastName
              });
              const email = (formData?.payer?.email ?? payer.email).trim();

              if (!email || !isValidEmail(email)) {
                const message = "Enter a valid email address to continue with Mercado Pago.";
                onError?.(message);
                const fallback: BrickSubmitResult = {
                  status: "error",
                  paymentId: null,
                  statusDetail: null,
                  errorMessage: message
                };
                notifyActions(fallback, actions, new Error(message));
                throw new Error(message);
              }

              const payload: MercadoPagoPaymentSubmitPayload = {
                token: formData!.token,
                paymentMethodId: formData!.payment_method_id,
                installments: sanitizeInstallments(
                  formData!.installments,
                  normalizedMinInstallments,
                  normalizedMaxInstallments
                ),
                issuerId: formData!.issuer_id ?? undefined,
                payer: {
                  email,
                  identification: {
                    type: identification.type,
                    number: identification.number
                  },
                  firstName: identification.firstName,
                  lastName: identification.lastName
                }
              };

              let notified = false;
              const notify = (result: BrickSubmitResult, err?: unknown) => {
                if (notified) return;
                notified = true;
                notifyActions(result, actions, err);
              };

              onProcessingChange?.(true);

              try {
                const result = await onSubmit(payload);
                const normalized: BrickSubmitResult = {
                  status: result.status,
                  paymentId: result.paymentId ?? null,
                  statusDetail: result.statusDetail ?? null,
                  errorMessage: result.errorMessage ?? null
                };

                if (normalized.status === "error" && normalized.errorMessage) {
                  onError?.(normalized.errorMessage);
                }

                notify(normalized);
                return normalized;
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "We couldn't process your payment with Mercado Pago. Please try again.";
                onError?.(message);

                const fallback: BrickSubmitResult = {
                  status: "error",
                  paymentId: null,
                  statusDetail: null,
                  errorMessage: message
                };

                notify(fallback, error);
                throw error;
              } finally {
                onProcessingChange?.(false);
              }
            },
            onError: (error: unknown) => {
              if (cancelled) {
                return;
              }
              setLoading(false);
              const message =
                error instanceof Error
                  ? error.message
                  : "An unexpected error occurred while loading Mercado Pago.";
              onError?.(message);
            }
          }
        };

        const controller = await bricksBuilder.create("payment", BRICK_CONTAINER_ID, settings);
        if (cancelled) {
          destroyController(controller);
          return;
        }
        controllerRef.current = controller;
      } catch (error) {
        if (cancelled) return;
        setLoading(false);
        const message =
          error instanceof Error ? error.message : "We were unable to initialize the Mercado Pago brick.";
        onError?.(message);
      }
    };

    void mountBrick();

    return () => {
      cancelled = true;
      destroyController(controllerRef.current);
      controllerRef.current = null;
    };
  }, [
    amount,
    description,
    locale,
    normalizedMaxInstallments,
    normalizedMinInstallments,
    onError,
    onProcessingChange,
    onReady,
    onSubmit,
    payer.email,
    payer.firstName,
    payer.lastName,
    preferenceId,
    publicKey
  ]);

  return (
    <Box>
      <Box
        id={BRICK_CONTAINER_ID}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="8px"
        padding="16px"
        minHeight="280px"
      />
      {loading && (
        <FlexBox alignItems="center" justifyContent="center" mt="1rem">
          <Spinner />
        </FlexBox>
      )}
      <Typography color="text.muted" fontSize="12px" mt="0.75rem">
        Pago seguro procesado por Mercado Pago.
        {description ? ` ${description}` : ""}
        {currency
          ? ` · Total estimado ${formatCurrencyAmount(amount, currency, resolveCurrencyLocale())}`
          : ""}
      </Typography>
      <Typography color="text.muted" fontSize="12px" mt="0.25rem">
        Modo prueba activo: utiliza tarjetas de prueba de Mercado Pago.
      </Typography>
    </Box>
  );
}
