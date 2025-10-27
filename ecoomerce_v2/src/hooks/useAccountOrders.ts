"use client";

import { useCallback, useEffect, useState } from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { OrderSummary } from "@/types/storefront";
import { useSession } from "@/state/session-context";

interface UseAccountOrdersResult {
  orders: OrderSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  token: string | null;
}

export function useAccountOrders(): UseAccountOrdersResult {
  const { session, status } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.accessToken ?? null;

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await StorefrontApi.listOrders(token);
      setOrders(data);
    } catch (cause) {
      if (isApiError(cause)) {
        setError(cause.payload?.message ?? cause.message);
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to load orders");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

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
    token
  };
}

interface UseAccountOrderResult {
  order: OrderSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  token: string | null;
}

export function useAccountOrder(identifier: string): UseAccountOrderResult {
  const { session, status } = useSession();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.accessToken ?? null;

  const refresh = useCallback(async () => {
    if (!token || !identifier) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await StorefrontApi.getOrder(token, identifier);
      setOrder(data);
    } catch (cause) {
      if (isApiError(cause)) {
        setError(cause.payload?.message ?? cause.message);
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to load order");
      }
    } finally {
      setLoading(false);
    }
  }, [token, identifier]);

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
    token
  };
}

