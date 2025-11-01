import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, CircuitOpenError, apiFetch, type ApiRequestOptions, createCorrelationId } from "@/lib/http";

interface RequestContext {
  signal: AbortSignal;
  correlationId: string;
}

export interface UseApiRequestOptions<TData, TTransformed = TData> {
  /**
   * Optional initial data to seed the hook.
   */
  initialData?: TTransformed;
  /**
   * Whether to execute the request automatically when dependencies change.
   */
  enabled?: boolean;
  /**
   * Transformation applied to the resolved data before storing it.
   */
  select?: (data: TData) => TTransformed;
  /**
   * Maintain the previous successful data while a new fetch is in-flight.
   */
  keepPreviousData?: boolean;
  /**
   * Dependencies that trigger a refetch when changed.
   */
  watch?: readonly unknown[];
}

export interface UseApiRequestResult<TData> {
  data: TData | undefined;
  error: ApiError | undefined;
  isLoading: boolean;
  isStale: boolean;
  correlationId: string | undefined;
  refetch: () => Promise<void>;
  resetError: () => void;
  isAutoRefreshing: boolean;
}

type RequestFactory<TData> = (ctx: RequestContext) => Promise<TData>;

export function useApiRequest<TData, TTransformed = TData>(
  requestFactory: RequestFactory<TData>,
  options: UseApiRequestOptions<TData, TTransformed> = {},
): UseApiRequestResult<TTransformed> {
  const {
    enabled = true,
    watch = [],
    initialData,
    select,
    keepPreviousData = true,
  } = options;

  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const [data, setData] = useState<TTransformed | undefined>(initialData);
  const [storedError, setStoredError] = useState<ApiError | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [correlationId, setCorrelationId] = useState<string | undefined>(undefined);
  const lastSuccessfulDataRef = useRef<TTransformed | undefined>(initialData);

  const execute = useCallback(async () => {
    if (!enabled) {
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const nextCorrelationId = createCorrelationId();
    setCorrelationId(nextCorrelationId);
    setIsLoading(true);
    inFlightRef.current = true;

    try {
      const payload = await requestFactory({
        signal: controller.signal,
        correlationId: nextCorrelationId,
      });
      const transformed = select ? select(payload) : ((payload as unknown) as TTransformed);
      lastSuccessfulDataRef.current = transformed;
      setData(transformed);
      setStoredError(undefined);
      setIsStale(false);
    } catch (rawError) {
      if (rawError instanceof ApiError) {
        if (rawError.isCancellation) {
          return;
        }
        setStoredError(rawError);
        if (keepPreviousData && lastSuccessfulDataRef.current !== undefined) {
          setData(lastSuccessfulDataRef.current);
          setIsStale(true);
        } else {
          setData(undefined);
        }
        if (rawError instanceof CircuitOpenError && keepPreviousData && lastSuccessfulDataRef.current !== undefined) {
          setIsStale(true);
        }
      } else if (rawError instanceof DOMException && rawError.name === "AbortError") {
        // ignore manual aborts
        return;
      } else {
        throw rawError;
      }
    } finally {
      inFlightRef.current = false;
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [enabled, keepPreviousData, requestFactory, select]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return () => controllerRef.current?.abort();
    }
    execute();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch);

  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  const resetError = useCallback(() => {
    setStoredError(undefined);
  }, []);

  return {
    data,
    error: storedError,
    isLoading,
    isStale,
    correlationId,
    refetch,
    resetError,
    isAutoRefreshing: inFlightRef.current,
  };
}

export function apiFetchFactory<TResponse>(
  path: string,
  init: ApiRequestOptions = {},
): RequestFactory<TResponse> {
  return ({ signal, correlationId }) => apiFetch<TResponse>(path, { ...init, signal, correlationId });
}
