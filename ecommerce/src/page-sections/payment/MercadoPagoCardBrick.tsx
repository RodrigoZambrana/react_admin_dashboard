"use client";

import { useEffect, useRef, useState } from "react";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const SCRIPT_ID = "mercado-pago-sdk";

export type MercadoPagoCardSubmitPayload = {
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
};

interface MercadoPagoCardBrickProps {
  publicKey: string;
  locale: string;
  amount: number;
  currency: string;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  description?: string;
  maxInstallments?: number;
  onSubmit: (payload: MercadoPagoCardSubmitPayload) => Promise<BrickSubmitResult>;
  onProcessingChange?: (processing: boolean) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

type CardPaymentFormData = {
  token: string;
  payment_method_id: string;
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

type CardPaymentSubmitEvent = {
  formData: CardPaymentFormData;
};

const initializeMercadoPago = (publicKey: string, locale: string) =>
  new Promise<MercadoPagoSdk>((resolve, reject) => {
    const instantiate = () => {
      if (typeof window === "undefined" || typeof window.MercadoPago !== "function") {
        reject(new Error("Mercado Pago SDK is not available"));
        return;
      }
      try {
        const instance = new window.MercadoPago(publicKey, { locale });
        resolve(instance);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to instantiate Mercado Pago"));
      }
    };

    if (typeof window !== "undefined" && window.MercadoPago) {
      instantiate();
      return;
    }

    if (typeof document === "undefined") {
      reject(new Error("Mercado Pago SDK can only be loaded in the browser"));
      return;
    }

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", instantiate, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Mercado Pago SDK")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SDK_URL;
    script.type = "text/javascript";
    script.async = true;
    script.onload = instantiate;
    script.onerror = () => reject(new Error("Failed to load Mercado Pago SDK"));
    document.body.appendChild(script);
  });

const ensureIdentification = (
  source: CardPaymentFormData["payer"],
  defaults: { firstName?: string; lastName?: string }
) => {
  const identification = source?.identification ?? {};
  const type = identification.type && identification.type.length > 0 ? identification.type : "DNI";
  const number =
    identification.number && identification.number.length > 0 ? identification.number : "00000000";
  return {
    type,
    number,
    firstName: source?.first_name ?? defaults.firstName,
    lastName: source?.last_name ?? defaults.lastName
  };
};

const sanitizeInstallments = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }
  return 1;
};

const containerId = "mp-card-payment-brick";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

export default function MercadoPagoCardBrick({
  publicKey,
  locale,
  amount,
  currency,
  payer,
  description,
  maxInstallments = 12,
  onSubmit,
  onProcessingChange,
  onReady,
  onError
}: MercadoPagoCardBrickProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MercadoPagoBricksController | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const mountBrick = async () => {
      try {
        setLoading(true);
        const sdk = await initializeMercadoPago(publicKey, locale);
        if (cancelled) return;

        controllerRef.current?.destroy();

        const bricksBuilder = sdk.bricks();
        const settings = {
          initialization: {
            amount,
            payer: {
              email: payer.email,
              firstName: payer.firstName,
              lastName: payer.lastName
            }
          },
          customization: {
            visual: {
              style: {
                theme: "default"
              }
            },
            paymentMethods: {
              maxInstallments
            }
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) {
                setLoading(false);
                onReady?.();
              }
            },
            onSubmit: async ({ formData }: CardPaymentSubmitEvent) => {
              const idData = ensureIdentification(formData.payer, {
                firstName: payer.firstName,
                lastName: payer.lastName
              });

              const email = formData.payer?.email?.trim() || payer.email.trim();

              if (!email || !isValidEmail(email)) {
                const message = "Ingresa un correo electrónico válido para continuar.";
                onError?.(message);
                throw new Error(message);
              }

              const payload: MercadoPagoCardSubmitPayload = {
                token: formData.token,
                paymentMethodId: formData.payment_method_id,
                installments: sanitizeInstallments(formData.installments),
                issuerId: formData.issuer_id ?? undefined,
                payer: {
                  email,
                  identification: {
                    type: idData.type,
                    number: idData.number
                  },
                  firstName: idData.firstName,
                  lastName: idData.lastName
                }
              };

              try {
                onProcessingChange?.(true);
                const result = await onSubmit(payload);
                return result;
              } catch (error) {
                if (onError) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : typeof error === "string"
                        ? error
                        : "No pudimos procesar tu pago.";
                  onError(message);
                }
                throw error;
              } finally {
                onProcessingChange?.(false);
              }
            },
            onError: (error: unknown) => {
              onProcessingChange?.(false);
              if (onError) {
                const message =
                  error instanceof Error
                    ? error.message
                    : typeof error === "string"
                      ? error
                      : "Ocurrió un error inesperado con Mercado Pago.";
                onError(message);
              }
            }
          }
        };

        const controller = await bricksBuilder.create("cardPayment", containerId, settings);
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
      } catch (error) {
        if (cancelled) return;
        setLoading(false);
        if (onError) {
          const message =
            error instanceof Error ? error.message : "No pudimos inicializar Mercado Pago.";
          onError(message);
        }
      }
    };

    if (amount > 0) {
      mountBrick();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [amount, locale, maxInstallments, onError, onProcessingChange, onReady, onSubmit, payer, publicKey]);

  return (
    <Box>
      <Box
        id={containerId}
        ref={containerRef}
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
        {currency ? ` · Total estimado ${amount.toFixed(2)} ${currency}` : ""}
      </Typography>
      <Typography color="text.muted" fontSize="12px" mt="0.25rem">
        Modo prueba activo: utiliza tarjetas de prueba de Mercado Pago.
      </Typography>
    </Box>
  );
}
