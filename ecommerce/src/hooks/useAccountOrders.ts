"use client";

import { useCallback, useEffect, useState } from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { OrderSummary } from "@/types/storefront";
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
          const message = cause.payload?.message ?? cause.message;
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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  token: string | null;
  needsReauthentication: boolean;
}

export function useAccountOrder(identifier: string): UseAccountOrderResult {
  const { session, status, logout } = useSession();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const data = await StorefrontApi.getOrder(token, identifier);
      setOrder(data);
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
        } else {
          const message = cause.payload?.message ?? cause.message;
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
    } finally {
      setLoading(false);
    }
  }, [token, identifier, logout, toast]);

  useEffect(() => {
    if (status === "authenticated" && token && identifier) {
      void refresh();
    } else if (status === "unauthenticated") {
      setOrder(null);
    }
  }, [status, token, identifier, refresh]);

  return {
    order,
    loading: status === "loading" || loading,
    error,
    refresh,
    token,
    needsReauthentication
  };
}
