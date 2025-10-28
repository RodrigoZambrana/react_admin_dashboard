export type MercadoPagoNormalizedStatus =
  | "approved"
  | "authorized"
  | "in_process"
  | "pending"
  | "processing"
  | "rejected";

const STATUS_DETAIL_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: "Your bank declined the transaction due to insufficient funds.",
  cc_rejected_bad_filled_security_code: "Security validation failed. Please check the CVV and try again.",
  cc_rejected_bad_filled_date: "Security validation failed. Please verify the expiry date.",
  cc_rejected_bad_filled_other: "Security validation failed. Please review your card details.",
  cc_rejected_high_risk: "Security validation failed. Please try again with another payment method.",
  cc_rejected_call_for_authorize: "Your bank declined the transaction. Please contact them to authorize the payment.",
  cc_rejected_card_disabled: "Your bank declined the transaction. Enable your card for online purchases and try again.",
  cc_rejected_blacklist: "Mercado Pago could not process this payment for security reasons.",
  cc_rejected_duplicated_payment: "This payment was already processed. Check your activity before retrying."
};

export const normalizeMercadoPagoStatus = (status?: string): MercadoPagoNormalizedStatus => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "authorized") return "authorized";
  if (normalized === "rejected" || normalized === "cancelled") return "rejected";
  if (normalized === "in_process" || normalized === "in_mediation") return "in_process";
  if (normalized === "pending") return "pending";
  return "processing";
};

export const resolveMercadoPagoDetailMessage = (detail?: string | null) => {
  if (!detail) return null;
  const normalized = detail.toLowerCase();
  return STATUS_DETAIL_MESSAGES[normalized] ?? null;
};

export const buildMercadoPagoStatusMessage = (
  status: MercadoPagoNormalizedStatus,
  detail?: string | null
) => {
  switch (status) {
    case "approved":
    case "authorized":
      return "Payment approved. You can continue to confirm your order.";
    case "in_process":
    case "pending":
      return "Mercado Pago is reviewing your payment. You can continue while the review completes.";
    case "rejected": {
      const specific = resolveMercadoPagoDetailMessage(detail);
      return specific ?? "Your bank declined the transaction. Please verify the details or try another card.";
    }
    case "processing":
      return "Processing payment with Mercado Pago...";
    default:
      return null;
  }
};

export { STATUS_DETAIL_MESSAGES as MERCADO_PAGO_STATUS_DETAIL_MESSAGES };
