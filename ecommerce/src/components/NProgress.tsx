// https://github.com/apal21/nextjs-progressbar/issues/86

"use client";

import { useEffect } from "react";
import NProgress from "nprogress";

import "nprogress/nprogress.css";

type PushStateInput = [data: any, unused: string, url?: string | URL | null | undefined];

export default function NProgressBar() {
  useEffect(() => {
    NProgress.configure({ showSpinner: false });

    const handleAnchorClick = (event: MouseEvent) => {
      const anchorElement = event.currentTarget as HTMLAnchorElement;

      // Skip anchors with target attribute but different than _self
      if (anchorElement.target !== "_self" && anchorElement.target?.trim() !== "") return;

      // Skip anchors with download attribute
      if (anchorElement.hasAttribute("download")) return;

      if (location.href !== anchorElement.href) NProgress.start();
    };

    const handleMutation: MutationCallback = () => {
      const anchorElements = document.querySelectorAll("a[href]");
      anchorElements.forEach((anchor) => anchor.addEventListener("click", handleAnchorClick));
    };

    const mutationObserver = new MutationObserver(handleMutation);
    mutationObserver.observe(document, { childList: true, subtree: true });

    window.history.pushState = new Proxy(window.history.pushState, {
      apply: (target, thisArg, argArray: PushStateInput) => {
        NProgress.done();
        return target.apply(thisArg, argArray);
      }
    });
  });

  return null;
}
