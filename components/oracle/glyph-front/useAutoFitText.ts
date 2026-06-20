"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Shrink font-size until block content fits its fixed-height container. */
export function useAutoFitText(deps: unknown[], minScale = 0.62) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let next = 1;
    el.style.setProperty("--glyph-fit-scale", "1");

    const fit = () => {
      if (!el) return;
      next = 1;
      el.style.setProperty("--glyph-fit-scale", "1");
      while (el.scrollHeight > el.clientHeight + 1 && next > minScale) {
        next = Number((next - 0.04).toFixed(2));
        el.style.setProperty("--glyph-fit-scale", String(next));
      }
      setScale(next);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, deps);

  return { ref, scale };
}
