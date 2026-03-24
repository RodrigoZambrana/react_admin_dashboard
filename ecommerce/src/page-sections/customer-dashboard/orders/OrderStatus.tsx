"use client";

import { useMemo } from "react";
import Image from "next/image";
import dayjs from "dayjs";

import Box from "@component/Box";
import Card from "@component/Card";
import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
import Avatar from "@component/avatar";
import type { OrderTimelineResponse, OrderTimelineEvent } from "@/types/orderTimeline";
import { useI18n, useTranslation } from "@/state/i18n-context";
import {
  getBadgePalette,
  resolvePaymentState,
  formatOrderBadgeLabel,
  PAYMENT_STATE_VARIANT,
  type StatusColorVariant,
  type OrderBadgeDescriptor,
} from "@/lib/utils/order-status";

type OrderPaymentInfo = {
  status?: string | null;
  statusDetail?: string | null;
  provider?: string | null;
  paymentId?: string | null;
  updatedAt?: string | null;
  amount?: {
    amount: number;
    currency: string;
  } | null;
};

type Props = {
  timeline?: OrderTimelineResponse | null;
  paymentInfo?: OrderPaymentInfo | null;
  loading?: boolean;
  error?: string | null;
};

type StepState = "pending" | "current" | "completed";

type DisplayEvent = {
  id: string;
  eventId: string;
  type: string;
  label: string;
  description?: string | null;
  timestamp: string;
  timestampLabel: string;
  estimateDate?: string | null;
  icon: string;
  state: StepState;
  isTerminal: boolean;
  amountValue?: number | null;
  remainingValue?: number | null;
};

type PaymentBadge = {
  state: "waiting" | "partial" | "full";
  label: string;
  detail?: string;
  color: StatusColorVariant;
};

type DeliveryBadge = {
  state: "delivered" | "estimated" | "unknown";
  label: string;
  detail?: string;
  color: StatusColorVariant;
};

type Summary = {
  events: DisplayEvent[];
  payment?: PaymentBadge;
  delivery?: DeliveryBadge;
};

type Translator = (key: string, params?: { defaultMessage?: string; values?: Record<string, string | number> }) => string;

const DEFAULT_EVENT_LABELS: Record<string, string> = {
  ORDER_RECEIVED: "Order received",
  PAYMENT_WAITING: "Waiting for payment",
  PAYMENT_PARTIAL: "Partial payment received",
  PAYMENT_FULL: "Payment received",
  PAYMENT_FULL_SUMMARY: "Payment complete",
  ESTIMATE_SET: "Estimated delivery date set",
  ESTIMATE_UPDATED: "Estimated delivery date updated",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Order cancelled",
  STATUS_CHANGED: "Status changed",
  NOTE: "Note added",
  OTHER: "Activity",
};

const ICON_BASE_PATH = "/assets/images/icons";
const iconPath = (file: string) => `${ICON_BASE_PATH}/${file}`;

const EVENT_ICON_FILES: Record<string, string> = {
  ORDER_RECEIVED: "order-icon.svg",
  PAYMENT_WAITING: "payment-2.svg",
  PAYMENT_PARTIAL: "payment-2.svg",
  PAYMENT_FULL: "payment-2.svg",
  PAYMENT_FULL_SUMMARY: "payment-2.svg",
  ESTIMATE_SET: "truck-1.svg",
  ESTIMATE_UPDATED: "truck-1.svg",
  SHIPPED: "truck-1.svg",
  IN_TRANSIT: "truck-1.svg",
  OUT_FOR_DELIVERY: "truck-1.svg",
  DELIVERED: "box-delivery.svg",
  CANCELLED: "box-delivery.svg",
  STATUS_CHANGED: "package-box.svg",
  NOTE: "comment.svg",
  OTHER: "package-box.svg",
};

const PAYMENT_EVENT_TYPES = new Set(["PAYMENT_WAITING", "PAYMENT_PARTIAL", "PAYMENT_FULL", "PAYMENT_FULL_SUMMARY"]);

const DONE_ICON_SRC = iconPath("done.svg");

const PAYMENT_BADGE_META: Record<PaymentBadge["state"], { defaultLabel: string }> = {
  waiting: {
    defaultLabel: "Payment pending"
  },
  partial: {
    defaultLabel: "Partial payment"
  },
  full: {
    defaultLabel: "Payment complete"
  }
};

const DELIVERY_BADGE_META: Record<DeliveryBadge["state"], { color: StatusColorVariant }> = {
  delivered: { color: "success" },
  estimated: { color: "primary" },
  unknown: { color: "secondary" }
};

const formatDate = (value?: string | null, locale?: string) => {
  if (!value) return "";
  const date = dayjs(value);
  if (!date.isValid()) return "";
  const localized = locale ? date.locale(locale) : date;
  return localized.format("DD MMM YYYY").toLowerCase();
};

const formatDateTime = (value?: string | null, locale?: string) => {
  if (!value) return "";
  const date = dayjs(value);
  if (!date.isValid()) return "";
  const localized = locale ? date.locale(locale) : date;
  return localized.format("DD MMM YYYY HH:mm").toLowerCase();
};

const formatAmount = (amount?: number | null, currency?: string | null, fallbackCurrency?: string | null) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  const code = (currency || fallbackCurrency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
};

const sanitizeDays = (value?: number | null) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.round(numeric));
};

const computeOrderEstimate = (order?: OrderTimelineResponse["order"]) => {
  if (!order) return null;
  const minDays = sanitizeDays(order.estimatedMin);
  const maxDays = sanitizeDays(order.estimatedMax);
  if (minDays === null && maxDays === null) return null;
  const anchor = dayjs(order.date ?? order.createdAt);
  if (!anchor.isValid()) return null;
  const offset = maxDays ?? minDays ?? 0;
  return {
    estimateDate: anchor.add(offset, "day"),
    minDays,
    maxDays,
  };
};

const getOrderIdentifier = (order: OrderTimelineResponse["order"]) =>
  order.uuid || order.reference || order.orderNumber || "order";

const dedupeByEventId = (events: OrderTimelineEvent[]) => {
  const seen = new Set<string>();
  const result: OrderTimelineEvent[] = [];
  for (const event of events) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    result.push(event);
  }
  return result;
};

const compareTimelineEvents = (a: OrderTimelineEvent, b: OrderTimelineEvent) => {
  const typeA = (a.type || "").toUpperCase();
  const typeB = (b.type || "").toUpperCase();
  const aCancelled = typeA === "CANCELLED";
  const bCancelled = typeB === "CANCELLED";
  if (aCancelled && !bCancelled) return 1;
  if (!aCancelled && bCancelled) return -1;
  const timeA = dayjs(a.timestamp).valueOf();
  const timeB = dayjs(b.timestamp).valueOf();
  return timeA - timeB;
};

const getTimelineDisplayRank = (type: string) => {
  switch ((type || "").toUpperCase()) {
    case "ORDER_RECEIVED":
      return 10;
    case "PAYMENT_WAITING":
      return 20;
    case "PAYMENT_PARTIAL":
      return 30;
    case "PAYMENT_FULL":
    case "PAYMENT_FULL_SUMMARY":
      return 40;
    case "ESTIMATE_SET":
    case "ESTIMATE_UPDATED":
      return 50;
    case "SHIPPED":
      return 60;
    case "IN_TRANSIT":
      return 70;
    case "OUT_FOR_DELIVERY":
      return 80;
    case "DELIVERED":
      return 90;
    case "CANCELLED":
      return 100;
    default:
      return 85;
  }
};

const resolveDisplayTimestamp = (event: Pick<OrderTimelineEvent, "type" | "timestamp" | "estimateDate" | "eventId">) => {
  const normalizedType = (event.type || "").toUpperCase();
  if (
    (normalizedType === "ESTIMATE_SET" || normalizedType === "ESTIMATE_UPDATED") &&
    typeof event.estimateDate === "string" &&
    dayjs(event.estimateDate).isValid()
  ) {
    return dayjs(event.estimateDate).valueOf();
  }

  return dayjs(event.timestamp).valueOf();
};

const isCompletedTimelineEvent = (type: string) => {
  const normalizedType = (type || "").toUpperCase();
  return normalizedType !== "PAYMENT_WAITING" && normalizedType !== "CANCELLED";
};

const isPaymentEvent = (event: OrderTimelineEvent) => PAYMENT_EVENT_TYPES.has((event.type || "").toUpperCase());

const ensurePaymentEvents = (
  events: OrderTimelineEvent[],
  order: OrderTimelineResponse["order"],
  paymentInfo: OrderPaymentInfo | null | undefined,
) => {
  const hasPaymentEvent = events.some((event) => isPaymentEvent(event));
  if (hasPaymentEvent || !paymentInfo) {
    return events;
  }

  const orderTotal = Number(order.grandTotal ?? 0);
  const orderCurrencyCode = (order.orderCurrency ?? "USD").toUpperCase();
  const paymentAmountValue =
    typeof paymentInfo.amount?.amount === "number" ? Number(paymentInfo.amount.amount) : null;
  const paymentCurrencyCode = (paymentInfo.amount?.currency ?? order.orderCurrency ?? "USD").toUpperCase();
  const normalizedStatus = (paymentInfo.status ?? "").toUpperCase();

  let paymentType: "PAYMENT_FULL" | "PAYMENT_PARTIAL" | "PAYMENT_WAITING" | null = null;
  if (
    normalizedStatus === "PAID" ||
    normalizedStatus === "COMPLETED" ||
    normalizedStatus === "SUCCESS" ||
    normalizedStatus === "PAYMENT_FULL"
  ) {
    paymentType = "PAYMENT_FULL";
  } else if (
    normalizedStatus === "PARTIAL" ||
    normalizedStatus === "PARTIALLY_PAID" ||
    normalizedStatus === "PARTIAL_PAYMENT"
  ) {
    paymentType = "PAYMENT_PARTIAL";
  } else if (
    normalizedStatus === "WAITING" ||
    normalizedStatus === "PENDING" ||
    normalizedStatus === "PENDING_CONFIRMATION" ||
    normalizedStatus === "PENDING_PAYMENT" ||
    normalizedStatus === "REQUIRES_PAYMENT_METHOD"
  ) {
    paymentType = "PAYMENT_WAITING";
  }

  if (!paymentType) {
    return events;
  }

  if (
    paymentType === "PAYMENT_FULL" &&
    paymentAmountValue !== null &&
    paymentCurrencyCode === orderCurrencyCode &&
    Math.abs(orderTotal - paymentAmountValue) > 0.01
  ) {
    paymentType = "PAYMENT_PARTIAL";
  }

  const timestampSource = paymentInfo.updatedAt ?? order.updatedAt ?? order.createdAt;
  const timestamp = dayjs(timestampSource).isValid()
    ? dayjs(timestampSource).toISOString()
    : new Date().toISOString();

  let remainingAmount: number | null = null;
  if (paymentType === "PAYMENT_FULL") {
    remainingAmount = 0;
  } else if (
    paymentType === "PAYMENT_PARTIAL" &&
    paymentAmountValue !== null &&
    paymentCurrencyCode === orderCurrencyCode
  ) {
    remainingAmount = Math.max(0, orderTotal - paymentAmountValue);
  } else if (paymentType === "PAYMENT_WAITING") {
    remainingAmount = Math.max(0, orderTotal);
  }

  const synthetic: OrderTimelineEvent = {
    eventId: `synthetic:order:${getOrderIdentifier(order)}:${paymentType.toLowerCase()}`,
    orderId: getOrderIdentifier(order),
    type: paymentType,
    timestamp,
    actor: paymentInfo.provider ?? "system",
    amount: paymentAmountValue,
    currency: paymentCurrencyCode,
    paymentMethod: null,
    remainingAmount,
    estimateDate: null,
    statusFrom: null,
    statusTo: null,
    message: paymentInfo.statusDetail ?? null,
    metadata: null,
  };

  const augmented = events.concat(synthetic);

  const hasPriorPartialPayment = augmented.some(
    (event) => (event.type || "").toUpperCase() === "PAYMENT_PARTIAL",
  );

  if (paymentType === "PAYMENT_FULL" && hasPriorPartialPayment) {
    const summaryTimestamp = dayjs(timestamp).add(1, "millisecond").toISOString();
    augmented.push({
      eventId: `synthetic:order:${getOrderIdentifier(order)}:payment_full_summary`,
      orderId: getOrderIdentifier(order),
      type: "PAYMENT_FULL_SUMMARY",
      timestamp: summaryTimestamp,
      actor: paymentInfo.provider ?? "system",
      amount: null,
      currency: null,
      paymentMethod: null,
      remainingAmount: 0,
      estimateDate: null,
      statusFrom: null,
      statusTo: null,
      message: paymentInfo.statusDetail ?? null,
      metadata: null,
    });
  }

  return augmented.sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());
};

type PaymentMetric = {
  amount: number | null;
  remaining: number | null;
};

const paymentTypeWeight = (type: string) => {
  const normalized = type.toUpperCase();
  if (normalized === "PAYMENT_WAITING") return 0;
  if (normalized === "PAYMENT_PARTIAL") return 1;
  if (normalized === "PAYMENT_FULL") return 2;
  return 3;
};

const computePaymentMetrics = (
  events: OrderTimelineEvent[],
  order: OrderTimelineResponse["order"],
): Map<string, PaymentMetric> => {
  const orderTotal = Number(order.grandTotal ?? 0);
  const hasValidTotal = Number.isFinite(orderTotal);
  const metrics = new Map<string, PaymentMetric>();

  if (!hasValidTotal) {
    return metrics;
  }

  let runningPaid = 0;

  const paymentsAsc = events
    .filter((event) => {
      const type = (event.type || "").toUpperCase();
      return type === "PAYMENT_WAITING" || type === "PAYMENT_PARTIAL" || type === "PAYMENT_FULL";
    })
    .sort((a, b) => {
      const timestampDiff = dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf();
      if (timestampDiff !== 0) {
        return timestampDiff;
      }
      const weightDiff =
        paymentTypeWeight(a.type || "") - paymentTypeWeight(b.type || "");
      if (weightDiff !== 0) {
        return weightDiff;
      }
      return a.eventId.localeCompare(b.eventId);
    });

  for (const event of paymentsAsc) {
    const normalized = (event.type || "").toUpperCase();
    let amount = typeof event.amount === "number" ? event.amount : null;
    let remaining =
      typeof event.remainingAmount === "number" && Number.isFinite(event.remainingAmount)
        ? Number(event.remainingAmount)
        : null;

    if (normalized === "PAYMENT_PARTIAL" || normalized === "PAYMENT_FULL") {
      if (amount !== null && Number.isFinite(amount)) {
        runningPaid += amount;
      }
      remaining = Math.max(0, Number(orderTotal - runningPaid));
      amount = amount !== null && Number.isFinite(amount) ? amount : null;
    } else if (normalized === "PAYMENT_WAITING") {
      remaining = Math.max(0, orderTotal - runningPaid);
    }

    metrics.set(event.eventId, {
      amount: amount ?? null,
      remaining: remaining ?? null,
    });
  }

  return metrics;
};

const buildPaymentBadge = (
  order: OrderTimelineResponse["order"],
  events: OrderTimelineEvent[],
  translate: Translator,
  metrics: Map<string, PaymentMetric>,
): PaymentBadge | undefined => {
  if (!order) return undefined;
  const total = Number(order.grandTotal ?? 0);

  let currency: string | null = order.orderCurrency ?? null;
  let remaining = total;

  const paymentsChronological = events
    .filter((event) => {
      const type = (event.type || "").toUpperCase();
      return type === "PAYMENT_WAITING" || type === "PAYMENT_PARTIAL" || type === "PAYMENT_FULL";
    })
    .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());

  const hasFullPaymentEvent = events.some((event) => {
    const type = (event.type || "").toUpperCase();
    return type === "PAYMENT_FULL" || type === "PAYMENT_FULL_SUMMARY";
  });

  for (const event of paymentsChronological) {
    if (!currency && event.currency) {
      currency = event.currency;
    }
    const type = (event.type || "").toUpperCase();
    const overrides = metrics.get(event.eventId);
    const remainingOverride = overrides?.remaining;
    const amountOverride = overrides?.amount;

    if (type === "PAYMENT_WAITING") {
      if (typeof remainingOverride === "number") {
        remaining = remainingOverride;
      }
    } else if (type === "PAYMENT_PARTIAL" || type === "PAYMENT_FULL") {
      if (typeof remainingOverride === "number") {
        remaining = remainingOverride;
      } else if (typeof amountOverride === "number") {
        remaining = Math.max(0, remaining - amountOverride);
      }
    }
  }

  let normalizedRemaining = Math.max(0, remaining);
  let paid = Math.max(0, total - normalizedRemaining);

  let state: PaymentBadge["state"] = "waiting";
  if (total <= 0) {
    state = paid > 0 || normalizedRemaining <= 0.01 ? "full" : "waiting";
  } else if (normalizedRemaining <= 0.01) {
    state = "full";
  } else if (paid > 0) {
    state = "partial";
  }

  const explicitState = order.paymentStatus
    ? resolvePaymentState(order.paymentStatus)
    : undefined;

  if (hasFullPaymentEvent) {
    state = "full";
    normalizedRemaining = 0;
    paid = total;
  } else if (explicitState === "full") {
    if (normalizedRemaining <= 0.01 || total <= 0) {
      state = "full";
      normalizedRemaining = 0;
      paid = total;
    } else {
      state = paid > 0 ? "partial" : "waiting";
    }
  } else if (explicitState === "partial") {
    state = "partial";
    normalizedRemaining = Math.max(0, total - paid);
  }

  const totalLabel = formatAmount(total, currency, order.orderCurrency) ?? total.toFixed(2);
  const paidLabel = formatAmount(paid, currency, order.orderCurrency) ?? paid.toFixed(2);
  const remainingLabel =
    formatAmount(normalizedRemaining, currency, order.orderCurrency) ?? normalizedRemaining.toFixed(2);

  const baseDescriptor: OrderBadgeDescriptor = {
    type: "payment",
    state,
    variant: PAYMENT_STATE_VARIANT[state],
    fallbackLabel: PAYMENT_BADGE_META[state].defaultLabel
  };
  const label = formatOrderBadgeLabel(baseDescriptor, translate);

  let detail: string | undefined;
  if (state === "full") {
    detail = translate("order.timeline.payment.summary.detail.full", {
      defaultMessage: `Paid ${totalLabel}`,
      values: { total: totalLabel }
    });
  } else if (state === "partial") {
    detail = translate("order.timeline.payment.summary.detail.partial", {
      defaultMessage: `Paid ${paidLabel} of ${totalLabel} (remaining ${remainingLabel})`,
      values: { paid: paidLabel, total: totalLabel, remaining: remainingLabel }
    });
  } else if (total > 0) {
    detail = translate("order.timeline.payment.summary.detail.waiting", {
      defaultMessage: `Outstanding ${totalLabel}`,
      values: { total: totalLabel }
    });
  }

  return {
    state,
    label,
    detail,
    color: baseDescriptor.variant
  };
};

const buildDeliveryBadge = (
  order: OrderTimelineResponse["order"],
  deliveredEvent: OrderTimelineEvent | null,
  estimateEvent: OrderTimelineEvent | null,
  translate: Translator,
  locale?: string,
): DeliveryBadge | undefined => {
  if (!order) return undefined;

  if (deliveredEvent) {
    const deliveredDate =
      formatDate(deliveredEvent.timestamp ?? null, locale) ??
      formatDate(deliveredEvent.estimateDate ?? null, locale);
    return {
      state: "delivered",
      label: translate("order.timeline.delivery.completed", {
        defaultMessage: deliveredDate ? `Delivered on ${deliveredDate}` : "Delivered",
        values: { date: deliveredDate ?? "" },
      }),
      detail: deliveredDate ?? undefined,
      color: DELIVERY_BADGE_META.delivered.color,
    };
  }

  if (estimateEvent?.estimateDate) {
    const estimate = formatDate(estimateEvent.estimateDate, locale);
    return {
      state: estimate ? "estimated" : "unknown",
      label: translate("order.timeline.estimate.badge", {
        defaultMessage: estimate ? `Estimated delivery ${estimate}` : "Estimated delivery",
        values: { date: estimate ?? "" },
      }),
      detail: estimate ?? undefined,
      color: DELIVERY_BADGE_META[estimate ? "estimated" : "unknown"].color,
    };
  }

  const computed = computeOrderEstimate(order);
  if (computed) {
    const fallback = computed.estimateDate.format("DD MMM YYYY").toLowerCase();
    return {
      state: "estimated",
      label: translate("order.timeline.estimate.badge", {
        defaultMessage: `Estimated delivery ${fallback}`,
        values: { date: fallback },
      }),
      detail: fallback,
      color: DELIVERY_BADGE_META.estimated.color,
    };
  }

  return undefined;
};

const getEventDescription = (
  event: OrderTimelineEvent,
  order: OrderTimelineResponse["order"],
  translate: Translator,
  locale?: string,
  overrides?: PaymentMetric | null,
) => {
  const type = (event.type || "").toUpperCase();
  const currency = event.currency ?? order.orderCurrency ?? null;
  const amountOverride = overrides ? overrides.amount : undefined;
  const remainingOverride = overrides ? overrides.remaining : undefined;
  const amountValue =
    typeof amountOverride === "number"
      ? amountOverride
      : typeof event.amount === "number"
        ? event.amount
        : null;
  const remainingValue =
    typeof remainingOverride === "number"
      ? remainingOverride
      : typeof event.remainingAmount === "number"
        ? event.remainingAmount
        : null;

  if (type === "PAYMENT_WAITING") {
    if (typeof remainingValue === "number") {
      const remainingLabel = formatAmount(remainingValue, currency, order.orderCurrency);
      return translate("order.timeline.payment.waitingWithRemaining", {
        defaultMessage: remainingLabel ? `Outstanding ${remainingLabel}` : "Waiting for payment",
        values: { remaining: remainingLabel ?? "" },
      });
    }
    return translate("order.timeline.payment.waiting", {
      defaultMessage: "Waiting for payment",
    });
  }

  if (type === "PAYMENT_PARTIAL") {
    const amountLabel = formatAmount(amountValue, currency, order.orderCurrency);
    const remainingLabel =
      typeof remainingValue === "number"
        ? formatAmount(remainingValue, currency, order.orderCurrency)
        : null;
    if (amountLabel && remainingLabel) {
      return translate("order.timeline.payment.amountWithRemaining", {
        defaultMessage: `${amountLabel} (remaining ${remainingLabel})`,
        values: { amount: amountLabel, remaining: remainingLabel },
      });
    }
    if (amountLabel) {
      return translate("order.timeline.payment.amountOnly", {
        defaultMessage: amountLabel,
        values: { amount: amountLabel },
      });
    }
  }

  if (type === "PAYMENT_FULL") {
    const amountLabel = formatAmount(amountValue, currency, order.orderCurrency);
    const remainingLabel =
      typeof remainingValue === "number"
        ? formatAmount(remainingValue, currency, order.orderCurrency)
        : formatAmount(0, currency, order.orderCurrency);
    if (amountLabel) {
      return translate("order.timeline.payment.fullAmount", {
        defaultMessage: `${amountLabel} (balance ${remainingLabel ?? "0.00"})`,
        values: { amount: amountLabel, remaining: remainingLabel ?? "0.00" },
      });
    }
  }

  if (type === "PAYMENT_FULL_SUMMARY") {
    return null;
  }

  if (type === "ORDER_RECEIVED") {
    return null;
  }

  if (type === "ESTIMATE_SET" || type === "ESTIMATE_UPDATED") {
    const estimate = formatDate(event.estimateDate ?? event.timestamp ?? null, locale);
    return translate("order.timeline.estimate.description", {
      defaultMessage: estimate ? `Estimated delivery ${estimate}` : "Estimated delivery",
      values: { date: estimate ?? "" },
    });
  }

  if (type === "DELIVERED") {
    const delivered = formatDate(event.timestamp ?? null, locale);
    return translate("order.timeline.delivery.completed", {
      defaultMessage: delivered ? `Delivered on ${delivered}` : "Delivered",
      values: { date: delivered ?? "" },
    });
  }

  if (type === "CANCELLED") {
    const cancelled = formatDate(event.timestamp ?? null, locale);
    return translate("order.timeline.status.cancelled", {
      defaultMessage: cancelled ? `Order cancelled on ${cancelled}` : "Order cancelled",
      values: { date: cancelled ?? "" },
    });
  }

  if (event.message) {
    return translate(event.message, { defaultMessage: event.message });
  }

  return null;
};

const determineEventState = (type: string): StepState => {
  if (type === "PAYMENT_WAITING") return "pending";
  if (type === "ESTIMATE_SET" || type === "ESTIMATE_UPDATED") return "current";
  return "completed";
};

const buildTimelineSummary = (
    timeline: OrderTimelineResponse | null,
    paymentInfo: OrderPaymentInfo | null | undefined,
    translate: Translator,
    locale?: string,
): Summary => {
  if (!timeline) {
    return { events: [] };
  }

  const order = timeline.order;
  const sorted = timeline.events.slice().sort(compareTimelineEvents);

  let startEvent =
    sorted.find((event) => (event.type || "").toUpperCase() === "ORDER_RECEIVED") ?? null;
  if (!startEvent) {
    startEvent = {
      eventId: `synthetic:order_received:${getOrderIdentifier(order)}`,
      orderId: getOrderIdentifier(order),
      type: "ORDER_RECEIVED",
      timestamp: order.createdAt,
      actor: "system",
      message: "Order received",
    };
    sorted.unshift(startEvent);
  }

  let deliveredEvent =
    sorted
      .filter((event) => (event.type || "").toUpperCase() === "DELIVERED")
      .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
      .pop() ?? null;

  let cancelledEvent =
    sorted
      .filter((event) => (event.type || "").toUpperCase() === "CANCELLED")
      .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
      .pop() ?? null;

  const estimateEventsSorted = sorted
    .filter((event) => {
      const type = (event.type || "").toUpperCase();
      return type === "ESTIMATE_SET" || type === "ESTIMATE_UPDATED";
    })
    .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());

  let earliestEstimateEvent = estimateEventsSorted.length > 0 ? estimateEventsSorted[0] : null;
  let latestEstimateEvent =
    estimateEventsSorted.length > 0 ? estimateEventsSorted[estimateEventsSorted.length - 1] : null;

  if (!latestEstimateEvent) {
    const computed = computeOrderEstimate(order);
    if (computed) {
      const fallbackTimestampSource = order.updatedAt ?? order.createdAt ?? order.date;
      const syntheticTimestamp = dayjs(fallbackTimestampSource).isValid()
        ? dayjs(fallbackTimestampSource).toISOString()
        : computed.estimateDate.toISOString();
      const syntheticEstimate = {
        eventId: `synthetic:estimate:${getOrderIdentifier(order)}`,
        orderId: getOrderIdentifier(order),
        type: "ESTIMATE_SET",
        timestamp: syntheticTimestamp,
        actor: "system",
        estimateDate: computed.estimateDate.toISOString(),
        metadata: {
          estimatedMinDays: computed.minDays ?? undefined,
          estimatedMaxDays: computed.maxDays ?? undefined,
        },
        message: "Estimated delivery date set",
      };
      sorted.push(syntheticEstimate);
      earliestEstimateEvent = syntheticEstimate;
      latestEstimateEvent = syntheticEstimate;
    }
  }

  const deduped = dedupeByEventId(sorted).sort(compareTimelineEvents);

  let normalizedEvents = deduped.slice();
  const hasCancelledEvent = normalizedEvents.some(
    (event) => (event.type || "").toUpperCase() === "CANCELLED",
  );
  if (!hasCancelledEvent) {
    const statusChangeToCancelled = normalizedEvents.find((event) => {
      const normalizedType = (event.type || "").toUpperCase();
      if (normalizedType !== "STATUS_CHANGED") {
        return false;
      }
      const statusTo = `${event.statusTo ?? ""}`.toLowerCase();
      return statusTo.includes("cancel");
    });
    if (statusChangeToCancelled) {
      normalizedEvents.push({
        ...statusChangeToCancelled,
        eventId: `${statusChangeToCancelled.eventId}:cancelled-fallback`,
        type: "CANCELLED",
      });
    }
  }

  normalizedEvents = normalizedEvents.sort(compareTimelineEvents);

  const cleanedEvents = normalizedEvents.filter(
    (event) => (event.type || "").toUpperCase() !== "STATUS_CHANGED",
  );

  const augmented = ensurePaymentEvents(cleanedEvents, order, paymentInfo);
  const timelineWithPayments = augmented.slice();

  const hasPaymentEvents = timelineWithPayments.some((event) =>
    PAYMENT_EVENT_TYPES.has((event.type || "").toUpperCase()),
  );
  if (!hasPaymentEvents) {
    const outstanding = Number(order.grandTotal ?? 0);
    if (outstanding > 0) {
      const fallbackTimestampSource = order.updatedAt ?? order.createdAt ?? order.date;
      const fallbackTimestamp = dayjs(fallbackTimestampSource).isValid()
        ? dayjs(fallbackTimestampSource).toISOString()
        : new Date().toISOString();
      timelineWithPayments.push({
        eventId: `synthetic:order:${getOrderIdentifier(order)}:payment_waiting`,
        orderId: getOrderIdentifier(order),
        type: "PAYMENT_WAITING",
        timestamp: fallbackTimestamp,
        actor: "system",
        amount: null,
        currency: order.orderCurrency ?? null,
        paymentMethod: null,
        remainingAmount: Number.isFinite(outstanding) ? outstanding : null,
        estimateDate: null,
        statusFrom: null,
        statusTo: null,
        message: "Waiting for payment",
        metadata: { synthetic: true },
      });
      timelineWithPayments.sort(compareTimelineEvents);
    }
  }

  const paymentMetrics = computePaymentMetrics(timelineWithPayments, order);

  if (!deliveredEvent) {
    deliveredEvent =
      timelineWithPayments
        .filter((event) => (event.type || "").toUpperCase() === "DELIVERED")
        .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
        .pop() ?? null;
  }

  if (!cancelledEvent) {
    cancelledEvent =
      timelineWithPayments
        .filter((event) => (event.type || "").toUpperCase() === "CANCELLED")
        .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
        .pop() ?? null;
  }

  const estimateEventForSummary = latestEstimateEvent ?? earliestEstimateEvent ?? null;

  const payment = buildPaymentBadge(order, timelineWithPayments, translate, paymentMetrics);
  const delivery = buildDeliveryBadge(order, deliveredEvent, estimateEventForSummary, translate, locale);

  const lastEvent =
    timelineWithPayments
      .slice()
      .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
      .pop() ?? null;
  const terminalId = (cancelledEvent ?? deliveredEvent ?? estimateEventForSummary ?? lastEvent)?.eventId ?? null;

  const displayEvents: DisplayEvent[] = timelineWithPayments.map((event) => {
    const normalized = (event.type || "").toUpperCase();
    const fallback =
      DEFAULT_EVENT_LABELS[normalized] ??
      normalized
        .toLowerCase()
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
    const label = translate(`order.timeline.event.${normalized.toLowerCase()}`, {
      defaultMessage: fallback,
    });
    const overrides = paymentMetrics.get(event.eventId) ?? null;
    const amountValue =
      overrides && typeof overrides.amount === "number"
        ? overrides.amount
        : typeof event.amount === "number"
          ? event.amount
          : null;
    const remainingValue =
      overrides && typeof overrides.remaining === "number"
        ? overrides.remaining
        : typeof event.remainingAmount === "number"
          ? event.remainingAmount
          : null;
    const description = getEventDescription(event, order, translate, locale, overrides);
    return {
      id: event.eventId,
      eventId: event.eventId,
      type: normalized,
      label,
      description,
      timestamp: event.timestamp,
      timestampLabel: formatDateTime(event.timestamp, locale),
      estimateDate: event.estimateDate ?? null,
      icon: iconPath(EVENT_ICON_FILES[normalized] ?? "package-box.svg"),
      state: determineEventState(normalized),
      isTerminal: terminalId ? event.eventId === terminalId : false,
      amountValue,
      remainingValue,
    };
  });

  return {
    events: displayEvents,
    payment,
    delivery,
  };
};

export default function OrderStatus({ timeline, paymentInfo = null, loading = false, error = null }: Props) {
  const { locale } = useI18n();
  const t = useTranslation();

  const summary = useMemo(
    () => buildTimelineSummary(timeline ?? null, paymentInfo, t, locale),
    [timeline, paymentInfo, t, locale],
  );

  const orderedEvents = useMemo(
    () =>
      summary.events
        .slice()
        .sort((a, b) => {
          const rankDiff = getTimelineDisplayRank(b.type) - getTimelineDisplayRank(a.type);
          if (rankDiff !== 0) return rankDiff;

          const timestampDiff = resolveDisplayTimestamp(b) - resolveDisplayTimestamp(a);
          if (timestampDiff !== 0) return timestampDiff;

          return b.id.localeCompare(a.id);
        }),
    [summary.events],
  );

  const hasCancelledEvent = useMemo(
    () => summary.events.some((event) => event.type === "CANCELLED"),
    [summary.events],
  );

  const paymentBadgePalette =
    !summary.payment || hasCancelledEvent ? null : getBadgePalette(summary.payment.color);
  const deliveryBadgePalette =
    !summary.delivery || hasCancelledEvent ? null : getBadgePalette(summary.delivery.color);

  return (
    <Card p="2rem 1.5rem" mb="30px" borderRadius={12}>
      <FlexBox justifyContent="space-between" alignItems="center" flexWrap="wrap" gridGap="0.75rem" mb="1.5rem">
        <Typography fontWeight={600} fontSize="18px">
          {t("Order timeline")}
        </Typography>
        <FlexBox gridGap="0.75rem" flexWrap="wrap">
          {paymentBadgePalette && summary.payment && (
            <Typography
              fontSize="13px"
              px="12px"
              py="6px"
              borderRadius="300px"
              bg={paymentBadgePalette.background}
              color={paymentBadgePalette.color}
              title={summary.payment.detail}
            >
              {summary.payment.label}
            </Typography>
          )}
          {summary.delivery && deliveryBadgePalette && (
            <Typography
              fontSize="13px"
              px="12px"
              py="6px"
              borderRadius="300px"
              bg={deliveryBadgePalette.background}
              color={deliveryBadgePalette.color}
              title={summary.delivery.detail}
            >
              {summary.delivery.label}
            </Typography>
          )}
        </FlexBox>
      </FlexBox>
      {loading ? (
        <Typography color="text.muted">{t("Loading timeline…")}</Typography>
      ) : error ? (
        <Typography color="error.main">{error}</Typography>
      ) : orderedEvents.length === 0 ? (
        <Typography color="text.muted">{t("No timeline events yet.")}</Typography>
      ) : (
        <Box position="relative">
          {orderedEvents.length > 1 && (
            <Box
              position="absolute"
              left="28px"
              top="28px"
              bottom="0"
              width="2px"
              bg="error.main"
              zIndex={0}
            />
          )}
          {orderedEvents.map((event, index) => {
            const isLast = index === orderedEvents.length - 1;
            const isCompleted = event.state === "completed";
            const hasCheck = isCompleted && isCompletedTimelineEvent(event.type);
            const showCancelBadge = event.type === "CANCELLED";
            const backgroundColor =
              event.type === "CANCELLED"
                ? "error.main"
                : isCompleted
                  ? "primary.main"
                  : "gray.300";

            return (
              <FlexBox key={event.id} alignItems="flex-start" mb={isLast ? "0" : "1.75rem"}>
                <Box position="relative" mr="18px" minWidth="60px" zIndex={1}>
                  <Avatar size={56} bg={backgroundColor} color="gray.white" borderRadius={40}>
                    <Image src={event.icon} alt={`${event.label} icon`} width={28} height={28} />
                  </Avatar>
                  {hasCheck && (
                    <Box position="absolute" right="-4px" top="-6px">
                      <Avatar size={22} bg="gray.200" color="success.main" borderRadius={20}>
                        <Image src={DONE_ICON_SRC} alt="Completed" width={12} height={12} />
                      </Avatar>
                    </Box>
                  )}
                  {showCancelBadge && (
                    <Box position="absolute" right="-4px" top="-6px">
                      <Avatar size={22} bg="gray.200" borderRadius={20}>
                        <Image src={iconPath("red-cross.svg")} alt="Cancelled" width={12} height={12} />
                      </Avatar>
                    </Box>
                  )}
                </Box>
                <Box flex="1">
                  <Typography fontWeight={600} color="text.primary" mb="0.25rem">
                    {event.label}
                  </Typography>
                  {event.description && (
                    <Typography fontSize="14px" color="text.muted" mb="0.25rem">
                      {event.description}
                    </Typography>
                  )}
                  <Typography fontSize="12px" color="text.hint">
                    {event.timestampLabel}
                  </Typography>
                </Box>
              </FlexBox>
            );
          })}
        </Box>
      )}
    </Card>
  );
}
