import { track } from "./tracking";

type AutoTrackEvent = MouseEvent & {
  target: HTMLElement | null;
};

export const initAutoTracking = () => {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const onClick = (event: Event) => {
    const mouseEvent = event as AutoTrackEvent;
    const target = mouseEvent.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    const element = target.closest("[data-track]");
    if (!element) {
      return;
    }

    track({
      event: element.getAttribute("data-track") || "click",
      data: {
        label: element.getAttribute("data-label"),
        location: window.location.pathname,
      },
    });
  };

  document.addEventListener("click", onClick, true);

  return () => {
    document.removeEventListener("click", onClick, true);
  };
};
