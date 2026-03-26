"use client";

import Sidenav from "@/components/sidenav/Sidenav";
import { useWebchat } from "@/state/webchat-context";

import WebchatDrawer from "./WebchatDrawer";
import WebchatLauncher from "./WebchatLauncher";

export default function WebchatRoot() {
  const { isOpen, close } = useWebchat();

  return (
    <Sidenav
      open={isOpen}
      width={430}
      position="right"
      scroll={false}
      onClose={close}
      handle={<WebchatLauncher />}
    >
      <WebchatDrawer />
    </Sidenav>
  );
}
