"use client";

import { useCallback, useEffect, useState } from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import type { OrderSummary } from "@/types/storefront";
import type { OrderTimelineResponse } from "@/types/orderTimeline";
import { useSession } from "@/state/session-context";
import { useToast } from "@/contexts/ToastContext";

interface UseAccountOrdersResult {
  orders: OrderSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  token: string | null;
  needsReauthentication: boolean;
}

export function useAccountOrders(): UseAccountOrdersResult {
  const { session, status, logout } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReauthentication, setNeedsReauthentication] = useState(false);
  const toast = useToast();

  const token = session?.accessToken ?? null;

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    setNeedsReauthentication(false);
    try {
      const data = await StorefrontApi.listOrders(token);
      setOrders(data);
    } catch (cause) {
      if (isApiError(cause)) {
        if (cause.status === 401) {
          setNeedsReauthentication(true);
          void logout();
          const message = "Your session has expired. Please log in again.";
          setError(message);
          toast.error({
            title: "Sesión expirada",
            description: "Tu sesión caducó. Vuelve a iniciar sesión para ver tus pedidos."
          });
        } else {
          const message = extractApiErrorMessage(cause);
          setError(message);
          toast.error({
            title: "No pudimos cargar tus pedidos",
            description: message
          });
        }
      } else if (cause instanceof Error) {
        setError(cause.message);
        toast.error({
          title: "No pudimos cargar tus pedidos",
          description: cause.message
        });
      } else {
        const message = "Unable to load orders";
        setError(message);
        toast.error({
          title: "No pudimos cargar tus pedidos",
          description: message
        });
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout, toast]);

  useEffect(() => {
    if (status === "authenticated" && token) {
      void refresh();
    } else if (status === "unauthenticated") {
      setOrders([]);
    }
  }, [status, token, refresh]);

  return {
    orders,
    loading: status === "loading" || loading,
    error,
    refresh,
    token,
    needsReauthentication
  };
}

interface UseAccountOrderResult {
  order: OrderSummary | null;
  timeline: OrderTimelineResponse | null;
  loading: boolean;
  timelineLoading: boolean;
  error: string | null;
  timelineError: string | null;
  refresh: () => Promise<void>;
  token: string | null;
  needsReauthentication: boolean;
}

export function useAccountOrder(identifier: string): UseAccountOrderResult {
  const { session, status, logout } = useSession();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<OrderTimelineResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [needsReauthentication, setNeedsReauthentication] = useState(false);
  const toast = useToast();

  const token = session?.accessToken ?? null;

  const refresh = useCallback(async () => {
    if (!token || !identifier) {
      return;
    }

    setLoading(true);
    setError(null);
    setNeedsReauthentication(false);
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const data = await StorefrontApi.getOrder(token, identifier);
      setOrder(data);
      try {
        const timelineResponse = await StorefrontApi.getOrderTimeline(token, identifier);
        setTimeline(timelineResponse);
        setTimelineError(null);
      } catch (cause) {
        setTimeline(null);
        if (isApiError(cause)) {
          const message = extractApiErrorMessage(cause);
          setTimelineError(message);
          toast.error({
            title: "No pudimos cargar la línea de tiempo",
            description: message
          });
        } else if (cause instanceof Error) {
          setTimelineError(cause.message);
        } else {
          setTimelineError("Unable to load order timeline");
        }
      }
    } catch (cause) {
      if (isApiError(cause)) {
        if (cause.status === 401) {
          setNeedsReauthentication(true);
          void logout();
          const message = "Your session has expired. Please log in again.";
          setError(message);
          toast.error({
            title: "Sesión expirada",
            description: "Tu sesión caducó. Vuelve a iniciar sesión para ver el pedido."
          });
        } else if (cause.status === 404 || cause.status === 410) {
          const message = "This item is no longer available.";
          setError(message);
          toast.error({
            title: "No pudimos encontrar el pedido",
            description: message
          });
        } else {
          const message = extractApiErrorMessage(cause);
          setError(message);
          toast.error({
            title: "No pudimos cargar el pedido",
            description: message
          });
        }
      } else if (cause instanceof Error) {
        setError(cause.message);
        toast.error({
          title: "No pudimos cargar el pedido",
          description: cause.message
        });
      } else {
        const message = "Unable to load order";
        setError(message);
        toast.error({
          title: "No pudimos cargar el pedido",
          description: message
        });
      }
      setTimeline(null);
    } finally {
      setLoading(false);
      setTimelineLoading(false);
    }
  }, [token, identifier, logout, toast]);

  useEffect(() => {
    if (status === "authenticated" && token && identifier) {
      void refresh();
    } else if (status === "unauthenticated") {
      setOrder(null);
      setTimeline(null);
    }
  }, [status, token, identifier, refresh]);

  return {
    order,
    timeline,
    loading: status === "loading" || loading,
    timelineLoading,
    error,
    timelineError,
    refresh,
    token,
    needsReauthentication
  };
}
