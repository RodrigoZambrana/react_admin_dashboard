"use client";

import dynamic from "next/dynamic";

const WebchatIsland = dynamic(() => import("./WebchatIsland"), {
  ssr: false,
});

export default function DeferredWebchatRoot() {
  return <WebchatIsland />;
}
