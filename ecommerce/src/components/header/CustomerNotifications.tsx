"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { StorefrontApi } from "@/lib/api/storefront";
import type { CustomerNotification } from "@/types/storefront";
import { env } from "@/lib/env";

const PANEL_HEIGHT = 320;

const formatSummary = (notification: CustomerNotification): string | null => {
  const metadata = notification.metadata ?? {};
  if (metadata.orderNumber) {
    return `#${metadata.orderNumber}`;
  }
  if (metadata.orderId) {
    return `#${metadata.orderId}`;
  }
  if (metadata.paymentId) {
    return `Payment ${metadata.paymentId}`;
  }
  return null;
};

export default function CustomerNotifications() {
  const { session, isAuthenticated } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !session) return;
    try {
      const result = await StorefrontApi.getNotificationUnreadCount(session.accessToken);
      setUnreadCount(result.count);
    } catch (error) {
      console.error("Failed to load notification count", error);
    }
  }, [isAuthenticated, session]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !session) return;
    setLoading(true);
    try {
      const result = await StorefrontApi.listNotifications(session.accessToken, {
        page: 1,
        pageSize: 20
      });
      setNotifications(result.items);
      setUnreadCount(result.meta.unread);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, session]);

  const connectStream = useCallback(() => {
    if (!isAuthenticated) {
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
  }, [isAuthenticated]);

  useEffect(() => {
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
    (toggle: () => void) => () => {
      if (!open) {
        void fetchNotifications();
      }
      toggle();
      setOpen((value) => !value);
    },
    [open, fetchNotifications]
  );

  const handleMarkAsRead = useCallback(
    async (id: number) => {
      if (!session) return;
      try {
        await StorefrontApi.markNotificationsRead(session.accessToken, { ids: [id] });
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        console.error("Failed to mark notification as read", error);
      }
    },
    [session]
  );

  const handleMarkAll = useCallback(async () => {
    if (!session || unreadCount === 0) return;
    try {
      await StorefrontApi.markNotificationsRead(session.accessToken, { markAll: true });
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark notifications", error);
    }
  }, [session, unreadCount]);

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
          <H6 mb="0">Notifications</H6>
          <Tiny
            role="button"
            color="text.muted"
            style={{ cursor: unreadCount > 0 ? "pointer" : "default" }}
            onClick={unreadCount > 0 ? handleMarkAll : undefined}
          >
            Mark all as read
          </Tiny>
        </FlexBox>
        <Box height={`${PANEL_HEIGHT}px`} overflow="hidden">
          {isAuthenticated ? (
            loading ? (
              <FlexBox alignItems="center" justifyContent="center" height="100%">
                <Spinner size={24} />
              </FlexBox>
            ) : entries.length > 0 ? (
              <Scrollbar style={{ maxHeight: `${PANEL_HEIGHT - 10}px` }}>
                {entries.map((item) => (
                  <MenuItem key={item.id} onClick={() => handleMarkAsRead(item.id)}>
                    <FlexBox flexDirection="column" gridGap="0.2rem">
                      <FlexBox alignItems="center" justifyContent="space-between" gridGap="0.5rem">
                        <Small fontWeight={600} color="text.primary">
                          {item.title ?? "Notification"}
                        </Small>
                        <Tiny color="text.muted">
                          {new Date(item.createdAt).toLocaleString()}
                        </Tiny>
                      </FlexBox>
                      {formatSummary(item) && (
                        <Tiny color="text.hint">{formatSummary(item)}</Tiny>
                      )}
                      {item.body && (
                        <Tiny color="text.secondary">{item.body}</Tiny>
                      )}
                      {!item.readAt && (
                        <FlexBox alignItems="center" gridGap="0.25rem" color="primary.main">
                          <IconCheck size={12} stroke={1.5} />
                          <Tiny>Tap to mark as read</Tiny>
                        </FlexBox>
                      )}
                    </FlexBox>
                  </MenuItem>
                ))}
              </Scrollbar>
            ) : (
              <FlexBox
                height="100%"
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
                gridGap="0.5rem"
              >
                <Typography color="text.muted">No notifications yet.</Typography>
                <Tiny color="text.hint">We will let you know about order updates here.</Tiny>
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
              <Typography color="text.muted">Sign in to view your notifications.</Typography>
            </FlexBox>
          )}
        </Box>
      </Box>
    </Menu>
  );
}
