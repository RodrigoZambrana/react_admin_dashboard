"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const SECURITY_SCRIPT_URL = "https://www.mercadopago.com/v2/security.js";
const SCRIPT_ID = "mercado-pago-sdk";
const SECURITY_SCRIPT_ID = "mercado-pago-security";
const BRICK_CONTAINER_ID = "payment-brick_container";
const DEFAULT_PAYMENT_ENDPOINT = "/api/process-payment";
const DEFAULT_SUCCESS_PATH = "/success";

type MercadoPagoBrickController = {
  destroy?: () => void;
  unmount?: () => void;
};

const destroyController = (
  controller: MercadoPagoBrickController | null | undefined,
) => {
  if (!controller) return;
  if (typeof controller.destroy === "function") {
    controller.destroy();
    return;
  }
  if (typeof controller.unmount === "function") {
    controller.unmount();
  }
};

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

type FeedbackState = {
  status: "idle" | "loading" | "success" | "error";
  title: string | null;
  detail: string | null;
};

const IDLE_FEEDBACK: FeedbackState = {
  status: "idle",
  title: null,
  detail: null,
};

type SubmitActions = {
  resolve?: (response?: SubmitResponse) => void;
  reject?: (reason?: unknown) => void;
  submitComplete?: (response: SubmitResponse) => void;
};

type SubmitEventArg =
  | SubmitPayload
  | {
      formData: SubmitPayload;
      actions?: SubmitActions;
      selectedPaymentMethod?: unknown;
    }
  | {
      formData: SubmitPayload;
      selectedPaymentMethod?: unknown;
    };

const extractFormData = (event: SubmitEventArg): SubmitPayload | null => {
  if (!event) return null;

  if ("formData" in event) {
    return event.formData ?? null;
  }

  return event;
};

const extractActions = (
  event: SubmitEventArg,
  fallback?: SubmitActions,
): SubmitActions | undefined => {
  if (event && typeof event === "object" && "actions" in event && event.actions) {
    return event.actions;
  }

  return fallback;
};

const appendQueryParams = (path: string, params: URLSearchParams) => {
  const query = params.toString();
  if (!query) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${query}`;
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
  const controllerRef = useRef<MercadoPagoBrickController | null>(null);
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(IDLE_FEEDBACK);

  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
  const paymentEndpoint =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PAYMENT_URL?.trim() || DEFAULT_PAYMENT_ENDPOINT;
  const successPathRaw = process.env.NEXT_PUBLIC_MERCADO_PAGO_SUCCESS_URL?.trim();
  const successRedirectPath = successPathRaw
    ? successPathRaw.startsWith("/")
      ? successPathRaw
      : `/${successPathRaw}`
    : DEFAULT_SUCCESS_PATH;
  const loader = useMercadoPago(publicKey, locale);

  const showFeedback = useCallback(
    (status: FeedbackState["status"], title?: string | null, detail?: string | null) => {
      setFeedback({
        status,
        title: title ?? null,
        detail: detail ?? null,
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      setFeedback(IDLE_FEEDBACK);
      if (!loader) {
        showFeedback("error", "Error de configuración", "La clave pública de Mercado Pago no está configurada.");
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

        destroyController(controllerRef.current);
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
                setFeedback(IDLE_FEEDBACK);
              }
            },
            onSubmit: async (
              submitEvent: SubmitEventArg,
              submitActions?: SubmitActions,
            ): Promise<SubmitResponse> => {
              showFeedback("loading", "Procesando pago...", null);

              const formData = extractFormData(submitEvent);
              const actions = extractActions(submitEvent, submitActions);
              let actionsNotified = false;

              if (!formData) {
                const errorMessage = "No pudimos leer los datos del formulario de Mercado Pago.";
                showFeedback("error", "Datos de pago incompletos", errorMessage);
                if (actions?.reject) {
                  actions.reject(new Error(errorMessage));
                  actionsNotified = true;
                }
                throw new Error(errorMessage);
              }

              const emailFromForm = formData.payer?.email ?? defaultEmail ?? null;
              if (!isValidEmail(emailFromForm)) {
                showFeedback(
                  "error",
                  "Debes ingresar un correo electrónico válido.",
                  "Mercado Pago requiere un email de contacto para el pagador.",
                );
                if (actions?.reject) {
                  actions.reject(new Error("El email del pagador es obligatorio."));
                  actionsNotified = true;
                }
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

              const notifySuccess = (response: SubmitResponse) => {
                actionsNotified = true;
                if (actions?.submitComplete) {
                  actions.submitComplete(response);
                } else {
                  actions?.resolve?.(response);
                }
              };

              const notifyError = (response: SubmitResponse, reason?: unknown) => {
                actionsNotified = true;
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
                  showFeedback("error", "Pago rechazado", String(fallbackMessage));

                  const error = new Error(String(fallbackMessage));
                  const errorResponse: SubmitResponse = {
                    status: "error",
                    paymentId,
                    statusDetail,
                    errorMessage: String(fallbackMessage),
                  };
                  notifyError(errorResponse, error);
                  throw error;
                }

                const successResponse: SubmitResponse = {
                  status: "success",
                  paymentId,
                  statusDetail,
                };

                showFeedback(
                  "success",
                  status ? `Pago ${status}` : "Pago aprobado",
                  paymentId || statusDetail
                    ? `ID: ${paymentId ?? "desconocido"} · Detalle: ${statusDetail ?? "sin detalle"}`
                    : null,
                );

                notifySuccess(successResponse);

                const params = new URLSearchParams();
                if (paymentId) params.set("paymentId", String(paymentId));
                if (status) params.set("status", status);
                if (statusDetail) params.set("detail", statusDetail);

                const redirectTarget = appendQueryParams(successRedirectPath, params);
                router.push(redirectTarget);

                return successResponse;
              } catch (error) {
                const fallbackMessage =
                  error instanceof Error ? error.message : "Error desconocido durante el pago.";

                setFeedback((prev) => {
                  if (prev.status === "error" && prev.detail) {
                    return prev;
                  }
                  return {
                    status: "error",
                    title: "Algo salió mal",
                    detail:
                      error instanceof Error && error.message === "Failed to fetch"
                        ? "No pudimos contactar al endpoint de pago. Verifica la URL, el servidor y los permisos de CORS."
                        : fallbackMessage,
                  };
                });

                if (!actionsNotified) {
                  notifyError(
                    {
                      status: "error",
                      paymentId: null,
                      statusDetail: null,
                      errorMessage: fallbackMessage,
                    },
                    error,
                  );
                }
                throw error;
              }
            },
            onError: (error: unknown) => {
              if (cancelled) return;
              const message =
                error instanceof Error ? error.message : "Ocurrió un error inesperado con Mercado Pago.";
              showFeedback("error", "Error en la carga del brick", message);
            },
          },
        };

        const controller = (await bricksBuilder.create(
          "cardPayment",
          BRICK_CONTAINER_ID,
          brickSettings,
        )) as MercadoPagoBrickController;
        if (cancelled) {
          destroyController(controller);
          return;
        }
        controllerRef.current = controller;
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "No pudimos inicializar el brick de pago.";
        showFeedback("error", "Error al inicializar Mercado Pago", message);
      }
    };

    if (amount > 0) {
      void mount();
    } else {
      showFeedback("error", "Monto inválido", "El monto debe ser mayor a 0.");
    }

    return () => {
      cancelled = true;
      destroyController(controllerRef.current);
      controllerRef.current = null;
    };
  }, [amount, currency, defaultEmail, description, loader, paymentEndpoint, router, showFeedback, successRedirectPath]);

  const { status, title, detail } = feedback;

  return (
    <div className="flex flex-col gap-3">
      <div id={BRICK_CONTAINER_ID} className="min-h-[320px] rounded-lg border p-4" />
      {status === "loading" && (
        <p className="text-sm text-blue-600" role="status">
          {title}
        </p>
      )}
      {status === "success" && title && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">{title}</p>
          {detail ? <p>{detail}</p> : null}
        </div>
      )}
      {status === "error" && title && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">{title}</p>
          {detail ? <p>{detail}</p> : null}
        </div>
      )}
    </div>
  );
}
