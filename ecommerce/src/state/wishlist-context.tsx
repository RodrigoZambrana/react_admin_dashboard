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
import { extractApiErrorMessage } from "@/lib/api/errors";
import type { CustomerWishlist, WishlistItem } from "@/types/storefront";
import { useSession } from "./session-context";
import { useToast } from "@/contexts/ToastContext";

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
const PENDING_WISHLIST_PRODUCT_KEY = "storefront.pendingWishlistProductId";

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, status, isAuthenticated, logout, updateWishlistSummary } = useSession();
  const token = session?.accessToken ?? null;
  const toast = useToast();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const isMounted = useRef(true);
  const isUpdating = pendingIds.size > 0;

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
      let message = "Unable to update wishlist. Please try again.";
      if (isApiError(cause)) {
        if (cause.status === 401) {
          void logout();
          message = "Your session expired. Please sign in again.";
          setError(message);
          toast.error({
            title: "Sesión expirada",
            description: "Vuelve a iniciar sesión para administrar tu lista de deseos."
          });
          return;
        }
        message = extractApiErrorMessage(cause);
      } else if (cause instanceof Error) {
        message = cause.message;
      }
      setError(message);
      toast.error({
        title: "No pudimos actualizar tu lista",
        description: message
      });
    },
    [logout, toast]
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
        toast.info({
          title: "Inicia sesión",
          description: "Necesitas iniciar sesión para usar tu lista de deseos."
        });
        throw new Error(errorMessage);
      }

      markPending(productId, true);
      setError(null);
      try {
        const response = await StorefrontApi.addWishlistItem(token, productId);
        applyResponse(response);
        toast.success({
          title: "Añadido a favoritos",
          description: "Guardamos el producto en tu lista de deseos."
        });
      } catch (cause) {
        handleRequestError(cause);
        throw cause;
      } finally {
        markPending(productId, false);
      }
    },
    [token, isAuthenticated, applyResponse, handleRequestError, markPending, toast]
  );

  const remove = useCallback(
    async (productId: number) => {
      if (!token || !isAuthenticated) {
        const errorMessage = "You need to sign in to manage your wishlist.";
        setError(errorMessage);
        toast.info({
          title: "Inicia sesión",
          description: "Necesitas iniciar sesión para usar tu lista de deseos."
        });
        throw new Error(errorMessage);
      }

      markPending(productId, true);
      setError(null);
      try {
        const response = await StorefrontApi.removeWishlistItem(token, productId);
        applyResponse(response);
        toast.info({
          title: "Eliminado de favoritos",
          description: "Quitamos el producto de tu lista de deseos."
        });
      } catch (cause) {
        handleRequestError(cause);
        throw cause;
      } finally {
        markPending(productId, false);
      }
    },
    [token, isAuthenticated, applyResponse, handleRequestError, markPending, toast]
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

  useEffect(() => {
    if (!isAuthenticated || !token || status !== "authenticated" || isLoading || isUpdating) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const pendingRaw = window.sessionStorage.getItem(PENDING_WISHLIST_PRODUCT_KEY);
    if (!pendingRaw) {
      return;
    }

    const pendingProductId = Number(pendingRaw);
    if (!Number.isFinite(pendingProductId) || pendingProductId <= 0) {
      window.sessionStorage.removeItem(PENDING_WISHLIST_PRODUCT_KEY);
      return;
    }

    if (hasItem(pendingProductId) || isPending(pendingProductId)) {
      window.sessionStorage.removeItem(PENDING_WISHLIST_PRODUCT_KEY);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        await add(pendingProductId);
      } catch {
        // Error already surfaced through wishlist toasts
      } finally {
        if (!cancelled) {
          window.sessionStorage.removeItem(PENDING_WISHLIST_PRODUCT_KEY);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [add, hasItem, isAuthenticated, isLoading, isPending, isUpdating, status, token]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      productIds,
      count,
      isLoading,
      isUpdating,
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
      isUpdating,
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
