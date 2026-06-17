"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Isolates react-mobile-picker touch gestures from page scroll on mobile browsers.
 * Swipes inside the zone rotate the wheel only; page scroll works outside the zone.
 */
export function PickerWheelZone({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const lockPageScroll = (e: TouchEvent) => {
      const target = e.target;
      if (!(target instanceof Node) || !el.contains(target)) return;
      if (e.cancelable) e.preventDefault();
    };

    el.addEventListener("touchmove", lockPageScroll, { passive: false, capture: true });
    return () => el.removeEventListener("touchmove", lockPageScroll, { capture: true });
  }, []);

  return (
    <div ref={ref} className={className ? `picker-wheel-zone ${className}` : "picker-wheel-zone"}>
      {children}
    </div>
  );
}
