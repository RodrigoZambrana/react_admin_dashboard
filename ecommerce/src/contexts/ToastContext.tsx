"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick?: () => void;
  closeOnClick?: boolean;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  type?: ToastVariant;
  duration?: number;
  action?: ToastAction;
}

export interface ToastMessage extends Required<Omit<ToastOptions, "duration" | "action">> {
  action?: ToastAction;
  duration: number;
  createdAt: number;
}

interface ToastContextValue {
  push: (options: ToastOptions) => string;
  success: (options: string | Omit<ToastOptions, "type">) => string;
  error: (options: string | Omit<ToastOptions, "type">) => string;
  info: (options: string | Omit<ToastOptions, "type">) => string;
  warning: (options: string | Omit<ToastOptions, "type">) => string;
  remove: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION = 4500;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
const DeferredToastViewport = dynamic(() => import("@/components/toast/ToastViewport"), {
  ssr: false
});

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeOptions = (options: ToastOptions): ToastMessage => ({
  id: options.id ?? generateId(),
  title: options.title?.trim() ?? "",
  description: options.description?.trim() ?? "",
  type: options.type ?? "info",
  duration: Number.isFinite(options.duration) && Number(options.duration) >= 0
    ? Number(options.duration)
    : DEFAULT_DURATION,
  action: options.action,
  createdAt: Date.now()
});

const buildHelpers =
  (push: ToastContextValue["push"]) =>
  (variant: ToastVariant, options: string | Omit<ToastOptions, "type">) => {
    if (typeof options === "string") {
      return push({
        description: options,
        type: variant
      });
    }
    return push({
      ...options,
      type: variant
    });
  };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const timeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setMessages((current) => current.filter((item) => item.id !== id));
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    timeouts.current.forEach((timeout) => clearTimeout(timeout));
    timeouts.current.clear();
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  const push = useCallback(
    (options: ToastOptions) => {
      const toast = normalizeOptions(options);
      setMessages((current) => [...current, toast]);
      if (toast.duration > 0) {
        const timeout = setTimeout(() => remove(toast.id), toast.duration);
        timeouts.current.set(toast.id, timeout);
      }
      return toast.id;
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(() => {
    const helper = buildHelpers(push);
    return {
      push,
      success: (opts) => helper("success", opts),
      error: (opts) => helper("error", opts),
      info: (opts) => helper("info", opts),
      warning: (opts) => helper("warning", opts),
      remove,
      clear
    };
  }, [push, remove, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <DeferredToastViewport toasts={messages} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export default ToastProvider;
