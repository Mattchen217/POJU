"use client";

import { useLayoutEffect, useRef } from "react";

/** Shrink a zone's `--{scaleVar}` until content fits (uses em-based children). */
export function useAutoFitText(
  deps: unknown[],
  minScale = 0.52,
  scaleVar = "glyph-fit-scale",
) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      if (!el) return;
      if (el.clientHeight < 4) return;
      let scale = 1;
      el.style.setProperty(`--${scaleVar}`, "1");
      for (let i = 0; i < 28 && scale > minScale; i++) {
        if (el.scrollHeight <= el.clientHeight + 1) break;
        scale = Number((scale - 0.035).toFixed(3));
        el.style.setProperty(`--${scaleVar}`, String(scale));
      }
    };

    const raf = requestAnimationFrame(() => requestAnimationFrame(fit));
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, deps);

  return ref;
}
