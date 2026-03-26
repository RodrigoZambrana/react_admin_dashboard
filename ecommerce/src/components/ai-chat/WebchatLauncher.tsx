"use client";

import Image from "next/image";
import { IconSparkles, IconX } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { useWebchat } from "@/state/webchat-context";

const PREVIEW_STORAGE_KEY = "storefront.webchat.preview.dismissed.v1";
const shellStyle: CSSProperties = {
  position: "fixed",
  bottom: "84px",
  right: "28px",
  zIndex: 2147483646,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "10px",
  pointerEvents: "none",
};

const previewStyle: CSSProperties = {
  width: "min(320px, calc(100vw - 2rem))",
  overflow: "hidden",
  borderRadius: "16px",
  border: "1px solid #E8E8E9",
  background: "#fff",
  boxShadow: "0 12px 34px rgba(20, 27, 39, 0.18)",
  pointerEvents: "auto",
  position: "relative",
  marginRight: "10px",
};

const bubbleStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  background: "#fff",
  boxShadow: "0 8px 24px rgba(20, 27, 39, 0.22)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "auto",
  border: "0",
  padding: 0,
  cursor: "pointer",
};

const previewTailStyle: CSSProperties = {
  position: "absolute",
  right: "18px",
  bottom: "-8px",
  width: "16px",
  height: "16px",
  background: "#fff",
  borderRight: "1px solid #E8E8E9",
  borderBottom: "1px solid #E8E8E9",
  transform: "rotate(45deg)",
};

const ctaPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#F3EEFF",
  color: "#6338F6",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function WebchatLauncher() {
  const { isOpen, isReady, open, controlMode, needsHuman, session } = useWebchat();
  const [isPreviewDismissed, setIsPreviewDismissed] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsMounted(true);
    setIsPreviewDismissed(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY) === "dismissed",
    );
  }, []);

  if (!isMounted || !isReady || isOpen) {
    return null;
  }

  const statusLabel = needsHuman || controlMode === "human"
    ? "Asesor disponible"
    : controlMode === "hybrid"
      ? "IA + humano"
      : "Asistente IA";
  const shouldShowPreview = !isPreviewDismissed && isPreviewActive;

  const handleDismissPreview = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsPreviewDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, "dismissed");
    }
  };

  const content = (
    <div
      style={shellStyle}
      data-testid="storefront-webchat-launcher-shell"
      onMouseEnter={() => setIsPreviewActive(true)}
      onMouseLeave={() => setIsPreviewActive(false)}
      onFocusCapture={() => setIsPreviewActive(true)}
      onBlurCapture={() => setIsPreviewActive(false)}
    >
      {shouldShowPreview ? (
        <div
          style={{
            ...previewStyle,
            width: "min(290px, calc(100vw - 2rem))",
          }}
          data-testid="storefront-webchat-preview"
          onClick={open}
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div style={ctaPillStyle}>
                <IconSparkles size={13} />
                <span>{session?.scope === "customer_authenticated" ? "Cuenta identificada" : "Consulta online"}</span>
              </div>
              <div className="mt-3 rounded-2xl bg-[#F7F8FA] px-4 py-3 text-sm leading-6 text-[#141B27] shadow-[0_1px_5px_1px_rgb(243,243,243)]">
                Hola.
                <br />
                ¿En qué podemos ayudarte hoy?
              </div>
              <div className="mt-2 text-xs font-medium text-[#72767D]">
                {statusLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissPreview}
              className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[#72767D] transition hover:bg-[#F7F8FA]"
              data-testid="storefront-webchat-preview-close"
              aria-label="Cerrar vista previa"
            >
              <IconX size={14} />
            </button>
          </div>
          <span aria-hidden="true" style={previewTailStyle} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={open}
        data-testid="storefront-webchat-launcher"
        aria-label="Abrir chat"
        style={bubbleStyle}
      >
        <Image
          src="/assets/images/chat/dreamschat-mark.svg"
          alt="Chat"
          width={48}
          height={48}
          className="h-8 w-8"
        />
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
