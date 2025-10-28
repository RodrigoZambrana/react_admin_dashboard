"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { CustomerWishlist, WishlistItem } from "@/types/storefront";
import { useSession } from "./session-context";

interface WishlistContextValue {
  items: WishlistItem[];
  productIds: number[];
  count: number;
  isLoading: boolean;
  isUpdating: boolean;
  isAuthenticated: boolean;
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  hasItem: (productId: number) => boolean;
  isPending: (productId: number) => boolean;
  add: (productId: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  toggle: (productId: number) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, status, isAuthenticated, logout, updateWishlistSummary } = useSession();
  const token = session?.accessToken ?? null;

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const resetState = useCallback(() => {
    if (!isMounted.current) {
      return;
    }
    setItems([]);
    setProductIds([]);
    setCount(0);
    setPendingIds(() => new Set());
    setIsLoading(false);
    setError(null);
    updateWishlistSummary({ count: 0, productIds: [] });
  }, [updateWishlistSummary]);

  const applyResponse = useCallback(
    (response: CustomerWishlist) => {
      if (!isMounted.current) {
        return;
      }
      const normalizedIds = Array.isArray(response.productIds) ? response.productIds : [];
      const nextCount =
        typeof response.count === "number" && Number.isFinite(response.count)
          ? Math.max(0, response.count)
          : normalizedIds.length;

      setItems(Array.isArray(response.items) ? response.items : []);
      setProductIds(normalizedIds);
      setCount(nextCount);
      updateWishlistSummary({ count: nextCount, productIds: normalizedIds });
    },
    [updateWishlistSummary]
  );

  const handleRequestError = useCallback(
    (cause: unknown) => {
      if (!isMounted.current) {
        return;
      }
      if (isApiError(cause)) {
        if (cause.status === 401) {
          logout();
          setError("Your session expired. Please sign in again.");
          return;
        }
        setError(cause.payload?.message ?? cause.message);
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to update wishlist. Please try again.");
      }
    },
    [logout]
  );

  const clearError = useCallback(() => {
    if (!isMounted.current) {
      return;
    }
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !isAuthenticated) {
      resetState();
      return;
    }
    if (!isMounted.current) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await StorefrontApi.getWishlist(token);
      applyResponse(response);
    } catch (cause) {
      handleRequestError(cause);
      throw cause;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [token, isAuthenticated, applyResponse, handleRequestError, resetState]);

  const markPending = useCallback((productId: number, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
  }, []);

  const add = useCallback(
    async (productId: number) => {
      if (!token || !isAuthenticated) {
        const errorMessage = "You need to sign in to manage your wishlist.";
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      markPending(productId, true);
      setError(null);
      try {
        const response = await StorefrontApi.addWishlistItem(token, productId);
        applyResponse(response);
      } catch (cause) {
        handleRequestError(cause);
        throw cause;
      } finally {
        markPending(productId, false);
      }
    },
    [token, isAuthenticated, applyResponse, handleRequestError, markPending]
  );

  const remove = useCallback(
    async (productId: number) => {
      if (!token || !isAuthenticated) {
        const errorMessage = "You need to sign in to manage your wishlist.";
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      markPending(productId, true);
      setError(null);
      try {
        const response = await StorefrontApi.removeWishlistItem(token, productId);
        applyResponse(response);
      } catch (cause) {
        handleRequestError(cause);
        throw cause;
      } finally {
        markPending(productId, false);
      }
    },
    [token, isAuthenticated, applyResponse, handleRequestError, markPending]
  );

  const hasItem = useCallback(
    (productId: number) => productIds.includes(productId),
    [productIds]
  );

  const isPending = useCallback((productId: number) => pendingIds.has(productId), [pendingIds]);

  const toggle = useCallback(
    async (productId: number) => {
      if (hasItem(productId)) {
        await remove(productId);
      } else {
        await add(productId);
      }
    },
    [add, remove, hasItem]
  );

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!isAuthenticated || !token) {
      resetState();
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) {
          // Error already reported
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated, token, refresh, resetState]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      productIds,
      count,
      isLoading,
      isUpdating: pendingIds.size > 0,
      isAuthenticated,
      error,
      clearError,
      refresh,
      hasItem,
      isPending,
      add,
      remove,
      toggle
    }),
    [
      items,
      productIds,
      count,
      isLoading,
      pendingIds.size,
      isAuthenticated,
      error,
      clearError,
      refresh,
      hasItem,
      isPending,
      add,
      remove,
      toggle
    ]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = (): WishlistContextValue => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
