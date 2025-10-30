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
  token?: string;
  payment_method_id?: string;
  paymentMethodId?: string;
  payment_type_id?: string;
  paymentTypeId?: string;
  installments?: number | string;
  issuer_id?: string;
  issuerId?: string;
  preference_id?: string;
  preferenceId?: string;
  metadata?: unknown;
  additional_info?: unknown;
  additionalInfo?: unknown;
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  [key: string]: unknown;
};

type SubmitResponse = {
  status: "success" | "pending" | "error";
  paymentId?: string | number | null;
  statusDetail?: string | null;
  errorMessage?: string | null;
};

type FeedbackState = {
  status: "idle" | "loading" | "success" | "pending" | "error";
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

const STATUS_DETAIL_MESSAGES: Record<string, string> = {
  cc_rejected_other_reason:
    "Mercado Pago rechazó el pago por un error general. Intenta nuevamente más tarde o usa otro medio de pago.",
  cc_rejected_general_error:
    "Ocurrió un error general al procesar el pago. Revisa los datos e intenta otra vez.",
  cc_rejected_call_for_authorize:
    "Debes comunicarte con la entidad emisora para autorizar esta transacción.",
  cc_rejected_insufficient_amount:
    "La tarjeta no tiene fondos suficientes para completar el pago.",
  cc_rejected_bad_filled_security_code:
    "El código de seguridad es incorrecto. Revísalo e inténtalo de nuevo.",
  cc_rejected_bad_filled_date:
    "La fecha de vencimiento es inválida. Verifica el mes y año de la tarjeta.",
  cc_rejected_bad_filled_other:
    "Revisa los datos ingresados en el formulario antes de volver a intentar.",
  pending_contingency:
    "Mercado Pago está revisando la operación. Te avisaremos cuando se acredite.",
  pending_review_manual:
    "Estamos verificando la información para aprobar el pago. El resultado se confirmará en breve.",
};

const PENDING_STATUSES = new Set([
  "in_process",
  "pending",
  "pending_waiting_payment",
  "pending_contingency",
  "pending_review_manual",
  "in_mediation",
]);

const FULL_PAYMENT_METHOD_AVAILABILITY: Record<string, "all"> = {
  bankTransfer: "all",
  creditCard: "all",
  debitCard: "all",
  ticket: "all",
  wallet_purchase: "all",
  walletPurchase: "all",
  onboarding_credits: "all",
  onboardingCredits: "all",
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractSelectedPaymentMethod = (event: SubmitEventArg): unknown => {
  if (event && typeof event === "object" && "selectedPaymentMethod" in event) {
    const selected = (event as { selectedPaymentMethod?: unknown }).selectedPaymentMethod;
    return selected;
  }
  return undefined;
};

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const cloneSerializable = <T,>(value: T): T | undefined => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return undefined;
  }
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
  const preferenceIdFromEnv = process.env.NEXT_PUBLIC_MERCADO_PAGO_PREFERENCE_ID?.trim();
  const [preferenceId, setPreferenceId] = useState<string | null>(
    preferenceIdFromEnv || null,
  );
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [isFetchingPreference, setIsFetchingPreference] = useState(false);
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
    if (preferenceIdFromEnv) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const createPreference = async () => {
      setPreferenceError(null);
      setIsFetchingPreference(true);

      try {
        const response = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: description ?? "Orden Mercado Pago",
            quantity: 1,
            unit_price: amount,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: unknown }
            | null;
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "No se pudo generar la preferencia de Mercado Pago.";
          throw new Error(message);
        }

        const payload = (await response.json()) as { preferenceId?: unknown };
        const idFromResponse =
          typeof payload.preferenceId === "string" ? payload.preferenceId.trim() : null;

        if (!idFromResponse) {
          throw new Error("La respuesta de Mercado Pago no incluyó una preferencia válida.");
        }

        if (!cancelled) {
          setPreferenceId(idFromResponse);
          setPreferenceError(null);
        }
      } catch (error) {
        if (abortController.signal.aborted || cancelled) {
          return;
        }

        console.error("Failed to auto-create Mercado Pago preference.", error);
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo generar la preferencia de Mercado Pago.";
        setPreferenceError(message);
      } finally {
        if (!cancelled) {
          setIsFetchingPreference(false);
        }
      }
    };

    void createPreference();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [amount, description, preferenceIdFromEnv]);

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

        if (!preferenceId && !preferenceIdFromEnv) {
          if (isFetchingPreference) {
            showFeedback(
              "loading",
              "Preparando medios de pago...",
              "Generando preferencia en Mercado Pago para habilitar todas las opciones.",
            );
            return;
          }

          if (preferenceError) {
            showFeedback(
              "error",
              "No pudimos habilitar todos los medios de pago",
              preferenceError,
            );
            return;
          }
        }

        const sdk = await loader();
        if (cancelled) {
          return;
        }

        destroyController(controllerRef.current);
        const bricksBuilder = sdk.bricks();

        const initialization: Record<string, unknown> = {
          payer: {
            email: defaultEmail ?? "test_user_123456@example.com",
          },
        };

        if (preferenceId) {
          initialization.preferenceId = preferenceId;
        } else {
          initialization.amount = amount;
          initialization.currency = currency;
        }

        const brickSettings = {
          initialization,
          customization: {
            visual: {
              style: {
                theme: "default",
              },
            },
            paymentMethods: {
              ...FULL_PAYMENT_METHOD_AVAILABILITY,
              maxInstallments: 12,
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
              const paymentMethodId =
                normalizeText(formData.payment_method_id) ?? normalizeText(formData.paymentMethodId) ?? null;

              if (!paymentMethodId) {
                const errorMessage =
                  "Mercado Pago no devolvió el identificador del medio de pago. Intenta nuevamente.";
                showFeedback("error", "Datos de pago incompletos", errorMessage);
                if (actions?.reject) {
                  actions.reject(new Error(errorMessage));
                  actionsNotified = true;
                }
                throw new Error(errorMessage);
              }

              const paymentTypeId =
                normalizeText(formData.payment_type_id) ?? normalizeText(formData.paymentTypeId) ?? undefined;
              const issuerId = normalizeText(formData.issuer_id) ?? normalizeText(formData.issuerId) ?? undefined;
              const selectedPaymentMethod = extractSelectedPaymentMethod(submitEvent);

              const identificationType = normalizeText(formData.payer?.identification?.type);
              const identificationNumber = normalizeText(
                formData.payer?.identification?.number,
              );
              const hasIdentification = Boolean(identificationType && identificationNumber);

              const firstName =
                normalizeText(formData.payer?.first_name) ?? normalizeText(formData.payer?.firstName);
              const lastName =
                normalizeText(formData.payer?.last_name) ?? normalizeText(formData.payer?.lastName);

              const payerSnakeCase: Record<string, unknown> = {
                email: effectiveEmail,
              };
              if (hasIdentification && identificationType && identificationNumber) {
                payerSnakeCase.identification = {
                  type: identificationType,
                  number: identificationNumber,
                };
              }
              if (firstName) {
                payerSnakeCase.first_name = firstName;
              }
              if (lastName) {
                payerSnakeCase.last_name = lastName;
              }

              const payerCamelCase: Record<string, unknown> = {
                email: effectiveEmail,
              };
              if (hasIdentification && identificationType && identificationNumber) {
                payerCamelCase.identification = {
                  type: identificationType,
                  number: identificationNumber,
                };
              }
              if (firstName) {
                payerCamelCase.firstName = firstName;
              }
              if (lastName) {
                payerCamelCase.lastName = lastName;
              }

              const metadata: Record<string, unknown> = {};
              if (isPlainObject(formData.metadata)) {
                const metadataClone = cloneSerializable(formData.metadata);
                if (metadataClone && isPlainObject(metadataClone)) {
                  Object.assign(metadata, metadataClone as Record<string, unknown>);
                }
              }

              const selectedPaymentMethodClone = cloneSerializable(selectedPaymentMethod);
              if (selectedPaymentMethodClone !== undefined) {
                metadata.selectedPaymentMethod = selectedPaymentMethodClone;
              }

              if (preferenceId) {
                metadata.preferenceId = preferenceId;
              }

              const hasMetadata = Object.keys(metadata).length > 0;

              const additionalInfoCandidate =
                (formData.additional_info ?? formData.additionalInfo) as unknown;
              let additionalInfo: Record<string, unknown> | undefined;
              if (isPlainObject(additionalInfoCandidate)) {
                const additionalInfoClone = cloneSerializable(additionalInfoCandidate);
                if (additionalInfoClone && isPlainObject(additionalInfoClone)) {
                  additionalInfo = additionalInfoClone as Record<string, unknown>;
                }
              }

              const payload: Record<string, unknown> = {
                // Snake_case keys used by the internal Next.js API route.
                payment_method_id: paymentMethodId,
                installments: sanitizedInstallments,
                transaction_amount: amount,
                description: description ?? "Sample Product",
                payer: payerSnakeCase,
                // CamelCase copies improve compatibility with the official
                // Mercado Pago sample backends (e.g. `/process_payment`).
                paymentMethodId,
                transactionAmount: amount,
              };

              const rawFormDataClone = cloneSerializable(formData);
              if (rawFormDataClone && isPlainObject(rawFormDataClone)) {
                payload.rawFormData = rawFormDataClone as Record<string, unknown>;
              }

              if (formData.token) {
                payload.token = formData.token;
              }

              if (issuerId) {
                payload.issuer_id = issuerId;
                payload.issuerId = issuerId;
              }

              if (paymentTypeId) {
                payload.payment_type_id = paymentTypeId;
                payload.paymentTypeId = paymentTypeId;
              }

              if (hasMetadata) {
                payload.metadata = metadata;
              }

              if (additionalInfo) {
                payload.additional_info = additionalInfo;
                payload.additionalInfo = additionalInfo;
              }

              if (preferenceId) {
                payload.preference_id = preferenceId;
                payload.preferenceId = preferenceId;
              }

              if (Object.keys(payerCamelCase).length > 0) {
                payload.payerCamelCase = payerCamelCase;
              }

              if (selectedPaymentMethodClone !== undefined) {
                payload.selectedPaymentMethod = selectedPaymentMethodClone;
              }

              const targetPaymentUrl = resolvePaymentUrl(paymentEndpoint);

              if (process.env.NODE_ENV !== "production") {
                console.info("Mercado Pago · enviando pago a:", targetPaymentUrl, payload);
              }

              const notifyCompletion = (response: SubmitResponse, reason?: unknown) => {
                actionsNotified = true;
                if (actions?.submitComplete) {
                  actions.submitComplete(response);
                }

                if (response.status === "error") {
                  if (actions?.reject) {
                    actions.reject(reason ?? response);
                  }
                  return;
                }

                if (!actions?.submitComplete) {
                  actions?.resolve?.(response);
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
                const normalizedStatus = status?.toLowerCase() ?? null;
                const normalizedStatusDetail = statusDetail?.toLowerCase() ?? null;
                const friendlyStatusDetail = normalizedStatusDetail
                  ? STATUS_DETAIL_MESSAGES[normalizedStatusDetail] ?? null
                  : null;

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
                  notifyCompletion(errorResponse, error);
                  throw error;
                }

                if (normalizedStatus && PENDING_STATUSES.has(normalizedStatus)) {
                  const pendingDetail =
                    friendlyStatusDetail ??
                    statusDetail ??
                    "Mercado Pago está procesando tu pago. Te avisaremos cuando se confirme.";
                  const pendingResponse: SubmitResponse = {
                    status: "pending",
                    paymentId,
                    statusDetail,
                  };

                  showFeedback("pending", "Pago en revisión", pendingDetail);
                  notifyCompletion(pendingResponse);
                  return pendingResponse;
                }

                if (normalizedStatus && normalizedStatus !== "approved") {
                  const rejectionDetail =
                    friendlyStatusDetail ??
                    statusDetail ??
                    "No pudimos procesar el pago, intenta nuevamente con otro medio.";
                  const rejectionError = new Error(rejectionDetail);
                  const rejectionResponse: SubmitResponse = {
                    status: "error",
                    paymentId,
                    statusDetail,
                    errorMessage: rejectionDetail,
                  };

                  showFeedback("error", "Pago rechazado", rejectionDetail);
                  notifyCompletion(rejectionResponse, rejectionError);
                  throw rejectionError;
                }

                const detailForSuccess =
                  friendlyStatusDetail ??
                  (paymentId || statusDetail
                    ? `ID: ${paymentId ?? "desconocido"} · Detalle: ${statusDetail ?? "sin detalle"}`
                    : null);

                const successResponse: SubmitResponse = {
                  status: "success",
                  paymentId,
                  statusDetail,
                };

                showFeedback("success", "Pago aprobado", detailForSuccess);

                notifyCompletion(successResponse);

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
                  notifyCompletion(
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
  }, [
    amount,
    currency,
    defaultEmail,
    description,
    loader,
    isFetchingPreference,
    paymentEndpoint,
    preferenceError,
    preferenceId,
    preferenceIdFromEnv,
    router,
    showFeedback,
    successRedirectPath,
  ]);

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
      {status === "pending" && title && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
