"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { CustomerProfile } from "@/types/storefront";
import { useSession } from "@/state/session-context";

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
        setError(cause.payload?.message ?? cause.message);
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to load profile");
      }
    } finally {
      setLoading(false);
    }
  }, [token, updateCustomerProfile]);

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
