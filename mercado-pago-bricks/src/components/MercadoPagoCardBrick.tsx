"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const SECURITY_SCRIPT_URL = "https://www.mercadopago.com/v2/security.js";
const SCRIPT_ID = "mercado-pago-sdk";
const SECURITY_SCRIPT_ID = "mercado-pago-security";
const BRICK_CONTAINER_ID = "payment-brick_container";
const DEFAULT_PAYMENT_ENDPOINT = "/api/process-payment";

type SubmitPayload = {
  token: string;
  payment_method_id: string;
  paymentMethodId?: string;
  installments?: number | string;
  issuer_id?: string;
  issuerId?: string;
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

type SubmitResponse = {
  status: "success" | "pending" | "error";
  paymentId?: string | number | null;
  statusDetail?: string | null;
  errorMessage?: string | null;
};

type SubmitActions = {
  resolve?: (response?: SubmitResponse) => void;
  reject?: (reason?: unknown) => void;
  submitComplete?: (response: SubmitResponse) => void;
};

type SubmitEvent = {
  formData: SubmitPayload;
  actions?: SubmitActions;
};

type Props = {
  amount: number;
  description?: string;
  locale?: string;
  currency?: string;
  defaultEmail?: string;
};

const ensureScript = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Mercado Pago SDK requires a browser environment."));
      return;
    }

    if (document.getElementById(SCRIPT_ID)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SDK_URL;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Mercado Pago SDK."));
    document.head.appendChild(script);
  });

const ensureSecurityScript = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Mercado Pago security script requires a browser environment."));
      return;
    }

    if (document.getElementById(SECURITY_SCRIPT_ID)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = SECURITY_SCRIPT_ID;
    script.src = SECURITY_SCRIPT_URL;
    script.async = true;
    script.setAttribute("view", "checkout");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Mercado Pago security script."));
    document.body.appendChild(script);
  });

const resolvePaymentUrl = (endpoint: string) => {
  const trimmed = endpoint.trim();

  if (!trimmed) {
    return DEFAULT_PAYMENT_ENDPOINT;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const looksLikeHostWithPort = /^[\w.-]+:\d+(?:\/|$)/.test(trimmed);
  if (looksLikeHostWithPort) {
    return `http://${trimmed}`;
  }

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    return new URL(normalized, window.location.origin).toString();
  } catch (error) {
    console.warn(
      "Falling back to normalized payment endpoint due to URL resolution error",
      error,
    );
    return normalized;
  }
};

const useMercadoPago = (publicKey: string | undefined, locale: string) =>
  useMemo(() => {
    if (!publicKey) return null;
    return async () => {
      await ensureScript();
      if (typeof window === "undefined" || !window.MercadoPago) {
        throw new Error("Mercado Pago SDK is unavailable.");
      }
      return new window.MercadoPago(publicKey, { locale });
    };
  }, [locale, publicKey]);

const isValidEmail = (value: string | undefined | null) =>
  typeof value === "string" && /\S+@\S+\.\S+/.test(value.trim());

const sanitizeInstallments = (installments: SubmitPayload["installments"]) => {
  if (typeof installments === "number") {
    return Number.isFinite(installments) && installments > 0 ? installments : 1;
  }
  if (typeof installments === "string") {
    const parsed = Number.parseInt(installments, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }
  return 1;
};

export default function MercadoPagoCardBrick({
  amount,
  description,
  locale = "es-AR",
  currency = "UYU",
  defaultEmail,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MercadoPagoBrickController | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
  const paymentEndpoint =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PAYMENT_URL?.trim() || DEFAULT_PAYMENT_ENDPOINT;
  const loader = useMercadoPago(publicKey, locale);

  const resetState = useCallback(() => {
    setStatusType("idle");
    setStatusMessage(null);
    setErrorDetails(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      resetState();
      if (!loader) {
        setStatusType("error");
        setStatusMessage("La clave pública de Mercado Pago no está configurada.");
        return;
      }

      try {
        try {
          await ensureSecurityScript();
        } catch (error) {
          console.warn(error instanceof Error ? error.message : error);
        }

        const sdk = await loader();
        if (cancelled) {
          return;
        }

        controllerRef.current?.destroy();
        const bricksBuilder = sdk.bricks();

        const brickSettings = {
          initialization: {
            amount,
            currency,
            payer: {
              email: defaultEmail ?? "test_user_123456@example.com",
            },
          },
          customization: {
            visual: {
              style: {
                theme: "default",
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) {
                setStatusType("idle");
                setStatusMessage(null);
              }
            },
            onSubmit: async ({ formData, actions }: SubmitEvent): Promise<SubmitResponse> => {
              setStatusType("loading");
              setStatusMessage("Procesando pago...");
              setErrorDetails(null);

              const emailFromForm = formData.payer?.email ?? defaultEmail ?? null;
              if (!isValidEmail(emailFromForm)) {
                setStatusType("error");
                setStatusMessage("Debes ingresar un correo electrónico válido.");
                setErrorDetails("Mercado Pago requiere un email de contacto para el pagador.");
                throw new Error("El email del pagador es obligatorio.");
              }

              const effectiveEmail = emailFromForm.trim();

              const sanitizedInstallments = sanitizeInstallments(formData.installments);
              const issuerId = formData.issuer_id ?? null;

              const payload = {
                token: formData.token,
                // Snake_case keys used by the internal Next.js API route.
                payment_method_id: formData.payment_method_id,
                installments: sanitizedInstallments,
                issuer_id: issuerId,
                transaction_amount: amount,
                description: description ?? "Sample Product",
                payer: {
                  email: effectiveEmail,
                  identification: {
                    type: formData.payer?.identification?.type ?? "DNI",
                    number: formData.payer?.identification?.number ?? "00000000",
                  },
                },
                // CamelCase copies improve compatibility with the official
                // Mercado Pago sample backends (e.g. `/process_payment`).
                paymentMethodId: formData.payment_method_id,
                issuerId,
                transactionAmount: amount,
              };

              const targetPaymentUrl = resolvePaymentUrl(paymentEndpoint);

              if (process.env.NODE_ENV !== "production") {
                console.info("Mercado Pago · enviando pago a:", targetPaymentUrl, payload);
              }

              const finalizeSuccess = (response: SubmitResponse) => {
                if (actions?.submitComplete) {
                  actions.submitComplete(response);
                } else {
                  actions?.resolve?.(response);
                }
              };

              const finalizeError = (response: SubmitResponse, reason?: unknown) => {
                if (actions?.submitComplete) {
                  actions.submitComplete(response);
                }
                if (actions?.reject) {
                  actions.reject(reason ?? response);
                }
              };

              try {
                const response = await fetch(targetPaymentUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });

                let data: Record<string, unknown> | null = null;
                try {
                  data = (await response.json()) as Record<string, unknown>;
                } catch (error) {
                  if (!response.ok) {
                    throw error instanceof Error ? error : new Error("Respuesta inválida del servidor de pagos.");
                  }
                }

                const paymentId = (data?.id as string | number | null) ?? null;
                const status = (data?.status as string | null) ?? null;
                const statusDetail = (data?.status_detail as string | null) ?? null;

                if (!response.ok) {
                  const fallbackMessage =
                    data?.error ?? data?.message ?? "No pudimos procesar el pago, intenta nuevamente.";
                  setStatusType("error");
                  setStatusMessage("Pago rechazado");
                  setErrorDetails(fallbackMessage);

                  const errorResponse: SubmitResponse = {
                    status: "error",
                    paymentId,
                    statusDetail,
                    errorMessage: String(fallbackMessage),
                  };

                  const rejection = new Error(String(fallbackMessage)) as Error & {
                    mpSubmitResponse?: SubmitResponse;
                  };
                  rejection.mpSubmitResponse = errorResponse;

                  throw rejection;
                }

                const successResponse: SubmitResponse = {
                  status: "success",
                  paymentId,
                  statusDetail,
                };

                setStatusType("success");
                setStatusMessage(status ? `Pago ${status}` : "Pago aprobado");
                setErrorDetails(
                  paymentId || statusDetail
                    ? `ID: ${paymentId ?? "desconocido"} · Detalle: ${statusDetail ?? "sin detalle"}`
                    : null,
                );

                finalizeSuccess(successResponse);

                return successResponse;
              } catch (error) {
                const submitResponseFromError =
                  error && typeof error === "object" && "mpSubmitResponse" in error
                    ? (error as { mpSubmitResponse?: SubmitResponse }).mpSubmitResponse ?? null
                    : null;

                const alreadyHandledByBrick = Boolean(submitResponseFromError);

                if (error instanceof Error) {
                  if (!alreadyHandledByBrick && error.message === "Failed to fetch") {
                    setErrorDetails(
                      "No pudimos contactar al endpoint de pago. Verifica que la URL sea correcta, que el servidor acepte solicitudes desde el navegador y que no existan bloqueos de CORS.",
                    );
                  } else if (!alreadyHandledByBrick) {
                    setErrorDetails(error.message);
                  }
                } else if (!alreadyHandledByBrick) {
                  setErrorDetails("Error desconocido durante el pago.");
                }

                if (!alreadyHandledByBrick) {
                  setStatusType("error");
                  setStatusMessage("Algo salió mal");
                }

                const errorResponse: SubmitResponse =
                  submitResponseFromError ?? {
                    status: "error",
                    errorMessage: error instanceof Error ? error.message : "Error desconocido durante el pago.",
                    paymentId: null,
                    statusDetail: null,
                  };

                if (alreadyHandledByBrick && errorResponse.errorMessage) {
                  setErrorDetails(errorResponse.errorMessage);
                }

                finalizeError(errorResponse, error);
                throw error;
              }
            },
            onError: (error: unknown) => {
              if (cancelled) return;
              setStatusType("error");
              const message =
                error instanceof Error ? error.message : "Ocurrió un error inesperado con Mercado Pago.";
              setStatusMessage("Error en la carga del brick");
              setErrorDetails(message);
            },
          },
        };

        const controller = await bricksBuilder.create("cardPayment", BRICK_CONTAINER_ID, brickSettings);
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatusType("error");
        const message =
          error instanceof Error ? error.message : "No pudimos inicializar el brick de pago.";
        setStatusMessage("Error al inicializar Mercado Pago");
        setErrorDetails(message);
      }
    };

    if (amount > 0) {
      void mount();
    } else {
      setStatusType("error");
      setStatusMessage("El monto debe ser mayor a 0.");
    }

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [amount, currency, defaultEmail, description, loader, paymentEndpoint, resetState]);

  return (
    <div className="flex flex-col gap-3">
      <div id={BRICK_CONTAINER_ID} ref={containerRef} className="min-h-[320px] rounded-lg border p-4" />
      {statusType === "loading" && (
        <p className="text-sm text-blue-600" role="status">
          {statusMessage}
        </p>
      )}
      {statusType === "success" && statusMessage && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">{statusMessage}</p>
          {errorDetails ? <p>{errorDetails}</p> : null}
        </div>
      )}
      {statusType === "error" && statusMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">{statusMessage}</p>
          {errorDetails ? <p>{errorDetails}</p> : null}
        </div>
      )}
    </div>
  );
}
