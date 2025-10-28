"use client";

import { useEffect } from "react";

import { GOOGLE_AUTH_STORAGE_KEY, decodeGoogleAuthWindowName, isGoogleAuthMessage } from "@/state/google-auth-channel";

const GoogleAuthBridge: React.FC = () => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = decodeGoogleAuthWindowName(window.name);
    if (!payload || !isGoogleAuthMessage(payload)) {
      return;
    }

    const enrichedPayload = { ...payload, deliveredAt: new Date().toISOString() };

    try {
      window.localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(enrichedPayload));
    } catch (error) {
      console.warn("[session] Failed to persist Google auth payload to storage", error);
    }

    window.name = "";

    const closeTimer = window.setTimeout(() => {
      try {
        window.close();
      } catch (error) {
        console.warn("[session] Unable to auto-close Google auth bridge window", error);
      }
    }, 150);

    return () => {
      window.clearTimeout(closeTimer);
    };
  }, []);

  return null;
};

export default GoogleAuthBridge;
