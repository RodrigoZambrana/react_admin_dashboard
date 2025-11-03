import { useEffect, useRef, useState } from "react";

import { getCachedValue, setCachedValue } from "@/lib/browser-cache";
import { ApiError, apiFetch } from "@/lib/http";
import { createCorrelationId } from "@/lib/http";
import { loadStorefrontSnapshot } from "@/lib/snapshots/loaders";
import type { StorefrontSnapshot } from "@/lib/snapshots/types";

type ResourceStatus = "idle" | "loading" | "success" | "error";

type PanelResourceOptions<TData> = {
  cacheKey: string;
  request: () => Promise<TData>;
  staleMs?: number;
  enabled?: boolean;
  snapshotSelector?: (snapshot: StorefrontSnapshot) => TData | null;
  snapshotEnabled?: boolean;
};

type PanelResourceState<TData> = {
  data: TData | undefined;
  error: ApiError | undefined;
  status: ResourceStatus;
  isRefreshing: boolean;
  isStale: boolean;
  correlationId?: string;
  source?: "live" | "cache" | "snapshot";
  snapshotAt?: string;
};

export function usePanelResource<TData>(options: PanelResourceOptions<TData>) {
  const {
    cacheKey,
    request,
    staleMs = 120_000,
    enabled = true,
    snapshotSelector,
    snapshotEnabled = true,
  } = options;
  const [state, setState] = useState<PanelResourceState<TData>>(() => ({
    data: undefined,
    error: undefined,
    status: "idle",
    isRefreshing: false,
    isStale: false,
    source: undefined,
    snapshotAt: undefined,
  }));

  const controllerRef = useRef<AbortController | null>(null);
  const snapshotSelectorRef = useRef<typeof snapshotSelector>(snapshotSelector);
  const snapshotEnabledRef = useRef<boolean>(snapshotEnabled);

  useEffect(() => {
    snapshotSelectorRef.current = snapshotSelector;
  }, [snapshotSelector]);

  useEffect(() => {
    snapshotEnabledRef.current = snapshotEnabled;
  }, [snapshotEnabled]);

  useEffect(() => {
    if (!enabled) {
      return () => controllerRef.current?.abort();
    }

    const cached = getCachedValue<TData>(cacheKey);
    if (cached !== null && state.status === "idle") {
      setState((prev) => ({
        ...prev,
        data: cached,
        status: "success",
        isStale: true,
        source: "cache",
      }));
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const correlationId = createCorrelationId();

    let active = true;

    const fetchData = async () => {
      setState((prev) => ({
        ...prev,
        status: cached ? "success" : "loading",
        isRefreshing: Boolean(cached),
        error: undefined,
        correlationId,
        source: cached ? prev.source ?? "cache" : undefined,
        snapshotAt: cached ? prev.snapshotAt : undefined,
      }));

      try {
        const data = await request();
        if (!active) return;
        setCachedValue(cacheKey, data, staleMs);
        setState({
          data,
          error: undefined,
          status: "success",
          isRefreshing: false,
          isStale: false,
          correlationId,
          source: "live",
          snapshotAt: undefined,
        });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.isCancellation) {
          return;
        }

        if (snapshotSelectorRef.current && snapshotEnabledRef.current) {
          try {
            const snapshotRecord = await loadStorefrontSnapshot();
            const snapshotData = snapshotRecord
              ? snapshotSelectorRef.current?.(snapshotRecord.value) ?? null
              : null;
            if (snapshotData) {
              setCachedValue(cacheKey, snapshotData, staleMs);
              setState({
                data: snapshotData,
                error: error instanceof ApiError ? error : undefined,
                status: "success",
                isRefreshing: false,
                isStale: true,
                correlationId,
                source: "snapshot",
                snapshotAt: snapshotRecord?.storedAt,
              });
              return;
            }
          } catch (snapshotError) {
            console.warn("[panel] Unable to load snapshot fallback.", snapshotError);
          }
        }

        setState((prev) => ({
          ...prev,
          status: prev.data ? "success" : "error",
          error: error instanceof ApiError ? error : undefined,
          isRefreshing: false,
          isStale: Boolean(prev.data),
          correlationId,
          source: prev.data ? prev.source : undefined,
          snapshotAt: prev.snapshotAt,
        }));
      }
    };

    fetchData();

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, request, staleMs, enabled, snapshotEnabled]);

  const refetch = async () => {
    if (!enabled) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const correlationId = createCorrelationId();

    try {
      setState((prev) => ({
        ...prev,
        isRefreshing: true,
        correlationId,
      }));
      const data = await request();
      setCachedValue(cacheKey, data, staleMs);
      setState({
        data,
        error: undefined,
        status: "success",
        isRefreshing: false,
        isStale: false,
        correlationId,
        source: "live",
        snapshotAt: undefined,
      });
    } catch (error) {
      if (error instanceof ApiError && error.isCancellation) {
        return;
      }

      if (snapshotSelectorRef.current && snapshotEnabledRef.current) {
        try {
          const snapshotRecord = await loadStorefrontSnapshot();
          const snapshotData = snapshotRecord
            ? snapshotSelectorRef.current?.(snapshotRecord.value) ?? null
            : null;
          if (snapshotData) {
            setCachedValue(cacheKey, snapshotData, staleMs);
            setState({
              data: snapshotData,
              error: error instanceof ApiError ? error : undefined,
              status: "success",
              isRefreshing: false,
              isStale: true,
              correlationId,
              source: "snapshot",
              snapshotAt: snapshotRecord?.storedAt,
            });
            return;
          }
        } catch (snapshotError) {
          console.warn("[panel] Unable to load snapshot fallback.", snapshotError);
        }
      }

      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof ApiError ? error : undefined,
        isStale: Boolean(prev.data),
        correlationId,
        source: prev.data ? prev.source : undefined,
        snapshotAt: prev.snapshotAt,
      }));
    }
  };

  return {
    ...state,
    refetch,
    hasData: Boolean(state.data),
  };
}

export function createApiPanelRequest<T>(path: string) {
  return () => apiFetch<T>(path, { cache: "no-store" });
}
