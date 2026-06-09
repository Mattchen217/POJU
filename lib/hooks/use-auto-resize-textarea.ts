import { useCallback, useEffect, type RefObject } from "react";

const DEFAULT_MAX_PX = 200;

/** Auto-grow textarea height up to maxPx, then scroll inside. */
export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxPx = DEFAULT_MAX_PX,
): void {
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, [ref, maxPx]);

  useEffect(() => {
    resize();
  }, [value, resize]);
}
