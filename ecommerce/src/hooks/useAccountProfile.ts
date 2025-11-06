"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import type { CustomerProfile } from "@/types/storefront";
import { useSession } from "@/state/session-context";
import { useToast } from "@/contexts/ToastContext";

interface UseAccountProfileResult {
  profile: CustomerProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateLocalProfile: (next: CustomerProfile) => void;
  token: string | null;
}

export function useAccountProfile(): UseAccountProfileResult {
  const { session, status, updateCustomerProfile } = useSession();
  const [profile, setProfile] = useState<CustomerProfile | null>(session?.customer ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const token = useMemo(() => session?.accessToken ?? null, [session?.accessToken]);

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await StorefrontApi.getAccountProfile(token);
      setProfile(result);
      updateCustomerProfile(result);
    } catch (cause) {
      if (isApiError(cause)) {
        const message = extractApiErrorMessage(cause);
        setError(message);
        toast.error({
          title: "No pudimos cargar tu perfil",
          description: message
        });
      } else if (cause instanceof Error) {
        setError(cause.message);
        toast.error({
          title: "No pudimos cargar tu perfil",
          description: cause.message
        });
      } else {
        const message = "Unable to load profile";
        setError(message);
        toast.error({
          title: "No pudimos cargar tu perfil",
          description: message
        });
      }
    } finally {
      setLoading(false);
    }
  }, [token, updateCustomerProfile, toast]);

  useEffect(() => {
    if (status === "authenticated" && token) {
      void refresh();
    } else if (status === "unauthenticated") {
      setProfile(null);
    }
  }, [status, token, refresh]);

  const updateLocalProfile = useCallback(
    (next: CustomerProfile) => {
      setProfile(next);
      updateCustomerProfile(next);
    },
    [updateCustomerProfile]
  );

  return {
    profile,
    loading: status === "loading" || loading,
    error,
    refresh,
    updateLocalProfile,
    token
  };
}
