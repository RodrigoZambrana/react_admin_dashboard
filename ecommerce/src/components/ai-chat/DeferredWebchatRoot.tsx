"use client";

import dynamic from "next/dynamic";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";

const WebchatIsland = dynamic(() => import("./WebchatIsland"), {
  ssr: false,
});
const SupportLauncher = dynamic(() => import("./SupportLauncher"), {
  ssr: false,
});

export default function DeferredWebchatRoot() {
  const config = useStorefrontConfig();
  const supportLauncher = config.features?.supportLauncher ?? "webchat";

  if (supportLauncher === "whatsapp") {
    return <SupportLauncher />;
  }

  return <WebchatIsland />;
}
