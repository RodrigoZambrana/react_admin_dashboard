export type StatusColorVariant = "primary" | "secondary" | "success" | "danger" | "blue";

export type PaymentState = "waiting" | "partial" | "full";

const STATUS_VARIANT_MAP: Record<string, StatusColorVariant> = {
  delivered: "success",
  fulfilled: "success",
  completed: "success",
  cancelled: "danger",
  canceled: "danger",
  void: "danger",
  pending: "secondary",
  processing: "secondary",
  created: "secondary",
  paid: "blue",
  paying: "blue",
  charged: "blue"
};

export const PAYMENT_STATE_VARIANT: Record<PaymentState, StatusColorVariant> = {
  waiting: "secondary",
  partial: "primary",
  full: "blue"
};

const PAYMENT_STATE_MAP: Record<string, PaymentState> = {
  paid: "full",
  captured: "full",
  authorized: "waiting",
  completed: "full",
  fulfilled: "full",
  waiting: "waiting",
  pending: "waiting",
  pending_confirmation: "waiting",
  processing: "waiting",
  in_process: "waiting",
  requires_payment_method: "waiting",
  partial: "partial",
  partially_paid: "partial",
  partial_payment: "partial",
  partpaid: "partial"
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const BADGE_PALETTE_OVERRIDES: Partial<Record<StatusColorVariant, { background: string; color: string }>> = {
  blue: { background: "blue.100", color: "blue.700" }
};

export const getBadgePalette = (
  variant: StatusColorVariant,
): { background: string; color: string } => {
  const override = BADGE_PALETTE_OVERRIDES[variant];
  if (override) {
    return override;
  }
  return {
    background: `${variant}.light`,
    color: `${variant}.main`,
  };
};

export const mapOrderStatusToVariant = (status?: string | null): StatusColorVariant => {
  const normalized = normalize(status);
  if (!normalized) {
    return "secondary";
  }
  return STATUS_VARIANT_MAP[normalized] ?? "secondary";
};

export const resolvePaymentState = (status?: string | null): PaymentState => {
  const normalized = normalize(status);
  if (normalized && PAYMENT_STATE_MAP[normalized]) {
    return PAYMENT_STATE_MAP[normalized];
  }
  return "waiting";
};

type OrderSummaryLike = {
  status?: string | null;
  statusLabel?: string | null;
  paymentStatus?: string | null;
  paymentStatusLabel?: string | null;
};

export type OrderBadgeDescriptor =
  | {
      type: "payment";
      state: PaymentState;
      variant: StatusColorVariant;
      fallbackLabel: string;
    }
  | {
      type: "status";
      variant: StatusColorVariant;
      fallbackLabel: string;
  };

export const resolveOrderBadgeDescriptor = (order: OrderSummaryLike): OrderBadgeDescriptor => {
  const statusCode = normalize(order.status);

  if (statusCode === "cancelled" || statusCode === "canceled") {
    return {
      type: "status",
      variant: "danger",
      fallbackLabel: order.statusLabel ?? order.paymentStatusLabel ?? "Cancelled",
    };
  }

  if (statusCode === "delivered" || statusCode === "fulfilled" || statusCode === "completed") {
    const variant = STATUS_VARIANT_MAP[statusCode] ?? "success";
    return {
      type: "status",
      variant,
      fallbackLabel: order.statusLabel ?? "Delivered",
    };
  }

  const paymentState = resolvePaymentState(order.paymentStatus ?? order.status);
  return {
    type: "payment",
    state: paymentState,
    variant: PAYMENT_STATE_VARIANT[paymentState],
    fallbackLabel:
      order.paymentStatusLabel ??
      order.statusLabel ??
      order.paymentStatus ??
      order.status ??
      "Pending",
  };
};

export type TranslateFn = (
  key: string,
  params?: { defaultMessage?: string; values?: Record<string, string | number> },
) => string;

export const formatOrderBadgeLabel = (descriptor: OrderBadgeDescriptor, translate: TranslateFn): string => {
  if (descriptor.type === "payment") {
    return translate(`order.timeline.payment.summary.labels.${descriptor.state}`, {
      defaultMessage: descriptor.fallbackLabel,
    });
  }
  return descriptor.fallbackLabel;
};
