"use client";

import { useWebchat } from "@/state/webchat-context";

export default function WebchatLauncher() {
  const { isOpen, isReady, open } = useWebchat();

  if (!isReady || isOpen) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      data-testid="storefront-webchat-launcher"
      className="fixed bottom-5 right-5 z-[60] rounded-full bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1e293b]"
    >
      Chat
    </button>
  );
}
