"use client";

import { WebchatProvider } from "@/state/webchat-context";

import WebchatRoot from "./WebchatRoot";

export default function WebchatIsland() {
  return (
    <WebchatProvider>
      <WebchatRoot />
    </WebchatProvider>
  );
}
