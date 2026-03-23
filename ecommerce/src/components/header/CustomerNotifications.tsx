"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { IconBell, IconCheck } from "@tabler/icons-react";
import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Menu from "@component/menu";
import MenuItem from "@component/MenuItem";
import IconButton from "@component/buttons/IconButton";
import Scrollbar from "@component/Scrollbar";
import Typography, { H6, Small, Tiny } from "@component/Typography";
import Spinner from "@component/Spinner";
import { useSession } from "@/state/session-context";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { CustomerNotification } from "@/types/storefront";
import { env } from "@/lib/env";
import { useToast } from "@/contexts/ToastContext";
import { useI18n, useTranslation } from "@/state/i18n-context";

const PANEL_HEIGHT = 320;

type TranslateFn = (key: string, params?: { values?: Record<string, string | number> }) => string;

const resolveOrderStatusLabel = (
  notification: CustomerNotification,
  locale: "en" | "es"
): string | null => {
  const metadata = notification.metadata ?? {};
  const rawStatusCode = metadata.statusCode;
  const statusCode =
    typeof rawStatusCode === "number"
      ? rawStatusCode
      : typeof rawStatusCode === "string"
        ? Number(rawStatusCode)
        : Number.NaN;

  if (Number.isFinite(statusCode)) {
    switch (statusCode) {
      case 100:
        return locale === "en" ? "Pending" : "Pendiente";
      case 200:
        return locale === "en" ? "Paid" : "Pagado";
      case 300:
        return locale === "en" ? "Cancelled" : "Cancelado";
      case 400:
        return locale === "en" ? "Delivered" : "Entregado";
      default:
        break;
    }
  }

  const status = metadata.status;
  return typeof status === "string" && status.trim().length > 0 ? status.trim() : null;
};

const formatNotificationCopy = (
  notification: CustomerNotification,
  t: TranslateFn,
  locale: "en" | "es"
): { title: string; body: string | null } => {
  const fallbackTitle = notification.title ?? t("notifications.panel.defaultTitle");
  const fallbackBody = notification.body ?? null;
  if (notification.eventType !== "ORDER_STATUS_CHANGED") {
    return { title: fallbackTitle, body: fallbackBody };
  }

  const metadata = notification.metadata ?? {};
  const orderNumber =
    (typeof metadata.orderNumber === "string" && metadata.orderNumber.trim()) ||
    (typeof metadata.orderId === "string" && metadata.orderId.trim()) ||
    (typeof metadata.orderId === "number" ? String(metadata.orderId) : "");
  const status = resolveOrderStatusLabel(notification, locale);

  if (!orderNumber || !status) {
    return { title: fallbackTitle, body: fallbackBody };
  }

  return {
    title: t("notifications.orderStatus.title", {
      values: { orderNumber, status }
    }),
    body: t("notifications.orderStatus.body", {
      values: { status }
    })
  };
};

const formatSummary = (notification: CustomerNotification, t: TranslateFn): string | null => {
  const metadata = notification.metadata ?? {};
  if (metadata.orderNumber) {
    return `#${metadata.orderNumber}`;
  }
  if (metadata.orderId) {
    return `#${metadata.orderId}`;
  }
  const paymentId = metadata.paymentId;
  if (hasEntityId(paymentId)) {
    return t("notifications.summary.payment", { values: { paymentId } });
  }
  return null;
};

const hasEntityId = (value: unknown): value is string | number => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return typeof value === "number";
};

const extractOrderPathSegment = (notification: CustomerNotification): string | null => {
  const metadata = notification.metadata ?? {};
  const uuid = metadata.orderUuid;
  if (typeof uuid === "string" && uuid.trim()) {
    return uuid.trim();
  }
  const orderNumber = metadata.orderNumber;
  if (typeof orderNumber === "string" && orderNumber.trim()) {
    return orderNumber.trim();
  }
  const metadataOrderId = metadata.orderId;
  if (hasEntityId(metadataOrderId)) {
    return String(metadataOrderId);
  }
  if (hasEntityId(notification.orderId)) {
    return String(notification.orderId);
  }
  return null;
};

const resolveNotificationPath = (notification: CustomerNotification): string => {
  const metadata = notification.metadata ?? {};
  const redirect =
    typeof metadata.redirectPath === "string" ? metadata.redirectPath.trim() : "";
  if (redirect) {
    return redirect;
  }
  const rawType = typeof metadata.type === "string" ? metadata.type.toLowerCase() : "";
  if (rawType === "order" || rawType === "payment") {
    const segment = extractOrderPathSegment(notification);
    if (segment) {
      if (rawType === "payment") {
        const paymentId = metadata.paymentId ?? notification.paymentId;
        if (hasEntityId(paymentId)) {
          return `/account/orders/${segment}?payment=${paymentId}`;
        }
      }
      return `/account/orders/${segment}`;
    }
    return "/account/orders";
  }
  if (rawType === "customer") {
    return "/account/profile";
  }
  if (rawType === "quote") {
    const segment = extractOrderPathSegment(notification);
    return segment ? `/account/orders/${segment}` : "/account/orders";
  }
  return "/account/orders";
};

export default function CustomerNotifications() {
  const { session, isAuthenticated, logout } = useSession();
  const { locale } = useI18n();
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const unauthorizedRef = useRef(false);
  const toast = useToast();
  const router = useRouter();
  const token = session?.accessToken ?? null;

  const handleUnauthorized = useCallback(() => {
    if (unauthorizedRef.current) {
      return;
    }
    unauthorizedRef.current = true;
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    toast.error({
      title: t("notifications.toast.sessionExpired.title"),
      description: t("notifications.toast.sessionExpired.description")
    });
    void logout();
  }, [logout, toast, t]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    try {
      const result = await StorefrontApi.getNotificationUnreadCount(token);
      setUnreadCount(result.count);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        handleUnauthorized();
        return;
      }
      console.error("Failed to load notification count", error);
    }
  }, [isAuthenticated, token, handleUnauthorized]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setLoading(true);
    try {
      const result = await StorefrontApi.listNotifications(token, {
        page: 1,
        pageSize: 20
      });
      setNotifications(result.items);
      setUnreadCount(result.meta.unread);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        handleUnauthorized();
        return;
      }
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, handleUnauthorized]);

  const connectStream = useCallback(() => {
    if (!isAuthenticated || !token) {
      return;
    }
    if (eventSourceRef.current) {
      return;
    }
    const source = new EventSource(
      `${env.publicApiBaseUrl}/account/notifications/events`,
      { withCredentials: true }
    );
    eventSourceRef.current = source;
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CustomerNotification;
        setNotifications((prev) => [data, ...prev].slice(0, 20));
        setUnreadCount((count) => count + (data.readAt ? 0 : 1));
      } catch (error) {
        console.error("Failed to parse notification event", error);
      }
    };
    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated) {
      unauthorizedRef.current = false;
    }
    if (isAuthenticated) {
      void fetchUnreadCount();
      connectStream();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, fetchUnreadCount, connectStream]);

  const handleToggle = useCallback(
    (toggle: (event: MouseEvent<HTMLElement>) => void) => (event: MouseEvent<HTMLElement>) => {
      if (!open) {
        void fetchNotifications();
      }
      toggle(event);
      setOpen((value) => !value);
    },
    [open, fetchNotifications]
  );

  const handleNotificationClick = useCallback(
    async (notification: CustomerNotification) => {
      if (!token) return;
      const wasUnread = !notification.readAt;
      try {
        await StorefrontApi.markNotificationsRead(token, { ids: [notification.id] });
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item
          )
        );
        if (wasUnread) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          handleUnauthorized();
          return;
        }
        console.error("Failed to mark notification as read", error);
      }
      try {
        const path = resolveNotificationPath(notification);
        router.push(path);
      } catch (err) {
        console.error("Failed to redirect from notification:", err);
      }
    },
    [token, handleUnauthorized, router]
  );

  const handleMarkAll = useCallback(async () => {
    if (!token || unreadCount === 0) return;
    try {
      await StorefrontApi.markNotificationsRead(token, { markAll: true });
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        handleUnauthorized();
        return;
      }
      console.error("Failed to mark notifications", error);
    }
  }, [token, unreadCount, handleUnauthorized]);

  const entries = useMemo(() => notifications, [notifications]);

  return (
    <Menu
      direction="right"
      handler={(toggle) => (
        <div className="notification-handler" onClick={handleToggle(toggle)}>
          <IconButton variant="text" padding="0.35rem">
            <IconBell size={22} stroke={1.6} />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </IconButton>
        </div>
      )}
    >
      <Box minWidth="280px" maxWidth="320px" padding="1rem">
        <FlexBox alignItems="center" justifyContent="space-between" mb="0.75rem">
          <H6 mb="0">{t("notifications.panel.title")}</H6>
          <Tiny
            role="button"
            color="text.muted"
            style={{ cursor: unreadCount > 0 ? "pointer" : "default" }}
            onClick={unreadCount > 0 ? handleMarkAll : undefined}
          >
            {t("notifications.panel.markAll")}
          </Tiny>
        </FlexBox>
        <Box height={`${PANEL_HEIGHT}px`} overflow="hidden">
          {isAuthenticated ? (
            loading ? (
              <FlexBox alignItems="center" justifyContent="center" height="100%">
                <Spinner />
              </FlexBox>
            ) : entries.length > 0 ? (
              <Scrollbar style={{ maxHeight: `${PANEL_HEIGHT - 10}px` }}>
                {entries.map((item) => {
                  const summary = formatSummary(item, t);
                  const copy = formatNotificationCopy(
                    item,
                    t,
                    locale === "en" ? "en" : "es"
                  );
                  return (
                    <MenuItem
                      key={item.id}
                      onClick={() => void handleNotificationClick(item)}
                      style={{
                        backgroundColor: !item.readAt ? "rgba(59, 130, 246, 0.08)" : undefined
                      }}
                    >
                      <FlexBox
                        flexDirection="column"
                        gridGap="0.2rem"
                        style={{ opacity: item.readAt ? 0.7 : 1 }}
                      >
                        <FlexBox alignItems="center" justifyContent="space-between" gridGap="0.5rem">
                          <Small fontWeight={600} color="text.primary">
                            {copy.title}
                          </Small>
                          <Tiny color="text.muted">
                            {new Date(item.createdAt).toLocaleString()}
                          </Tiny>
                        </FlexBox>
                        {summary && <Tiny color="text.hint">{summary}</Tiny>}
                        {copy.body && <Tiny color="text.secondary">{copy.body}</Tiny>}
                        {!item.readAt && (
                          <FlexBox alignItems="center" gridGap="0.25rem" color="primary.main">
                            <IconCheck size={12} stroke={1.5} />
                            <Tiny>{t("notifications.panel.markAsRead")}</Tiny>
                          </FlexBox>
                        )}
                      </FlexBox>
                    </MenuItem>
                  );
                })}
              </Scrollbar>
            ) : (
              <FlexBox
                height="100%"
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
                gridGap="0.5rem"
              >
                <Typography color="text.muted">{t("notifications.empty.title")}</Typography>
                <Tiny color="text.hint">{t("notifications.empty.subtitle")}</Tiny>
              </FlexBox>
            )
          ) : (
            <FlexBox
              height="100%"
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
              gridGap="0.5rem"
            >
              <Typography color="text.muted">{t("notifications.unauthenticated")}</Typography>
            </FlexBox>
          )}
        </Box>
      </Box>
    </Menu>
  );
}
