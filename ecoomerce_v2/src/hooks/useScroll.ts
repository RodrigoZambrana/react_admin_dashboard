"use client";

import { useCallback, useEffect, useState } from "react";

export default function useScroll(height = 60) {
  const [isFixed, setFixed] = useState(false);

  const scrollListener = useCallback(() => {
    const scrollTop = window.scrollY;
    setFixed(scrollTop > height);
  }, [height]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("scroll", scrollListener);
    return () => {
      window.removeEventListener("scroll", scrollListener);
    };
  }, [scrollListener]);

  return { isFixed };
}
