"use client";

import WebchatDrawer from "./WebchatDrawer";
import WebchatLauncher from "./WebchatLauncher";

export default function WebchatRoot() {
  return (
    <>
      <WebchatLauncher />
      <WebchatDrawer />
    </>
  );
}
