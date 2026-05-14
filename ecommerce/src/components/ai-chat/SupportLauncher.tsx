"use client";

import { IconBrandWhatsapp } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";

const launcherStyle: CSSProperties = {
  position: "fixed",
  right: "28px",
  bottom: "28px",
  zIndex: 2147483646,
  width: "56px",
  height: "56px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  background: "#25D366",
  boxShadow: "0 16px 32px rgba(37, 211, 102, 0.28)",
};

export default function SupportLauncher() {
  const config = useStorefrontConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const whatsappHref = useMemo(() => {
    const phone = config.companyProfile?.phone?.trim() ?? "";
    const digits = phone.replace(/[^\d]/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  }, [config.companyProfile?.phone]);

  if (!mounted || !whatsappHref) {
    return null;
  }

  return createPortal(
    <a
      href={whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir WhatsApp"
      data-testid="storefront-whatsapp-launcher"
      style={launcherStyle}>
      <IconBrandWhatsapp size={30} color="#ffffff" stroke={1.8} />
    </a>,
    document.body,
  );
}
