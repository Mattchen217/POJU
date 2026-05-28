"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

import {
  clearMarketingSplineVisibility,
  marketingSplineSlotGranted,
  marketingSplineStaggerMs,
  pinMarketingSplineLoaded,
  setMarketingSplineVisibility,
  subscribeMarketingSplineSlots,
} from "@/lib/client/marketing-spline-slots";

import "@/styles/chart-loader.css";

type ProductCardSplineFrameProps = {
  cardKey: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
};

/**
 * Lazy-mounts Spline when the card first enters the viewport (staggered, slot-capped on PWA).
 * After the first load, the scene stays mounted — scrolling away does not destroy WebGL.
 */
export function ProductCardSplineFrame({
  cardKey,
  className,
  innerClassName,
  children,
}: ProductCardSplineFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const everMountedRef = useRef(false);
  const [inView, setInView] = useState(false);
  const [hasSlot, setHasSlot] = useState(false);
  const [showScene, setShowScene] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
        const visible = ratio > 0.1;
        setInView(visible);
        if (!everMountedRef.current) {
          setMarketingSplineVisibility(cardKey, visible ? ratio : 0);
        }
      },
      { rootMargin: "64px 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75] },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (!everMountedRef.current) {
        clearMarketingSplineVisibility(cardKey);
      }
    };
  }, [cardKey]);

  useEffect(() => {
    if (everMountedRef.current) {
      setHasSlot(true);
      return;
    }
    if (!inView) {
      setHasSlot(false);
      return;
    }
    const sync = () => setHasSlot(marketingSplineSlotGranted(cardKey));
    sync();
    return subscribeMarketingSplineSlots(sync);
  }, [inView, cardKey]);

  useEffect(() => {
    if (everMountedRef.current) return;
    if (!hasSlot) return;

    const delay = marketingSplineStaggerMs(cardKey);
    const timer = window.setTimeout(() => {
      everMountedRef.current = true;
      pinMarketingSplineLoaded(cardKey);
      setShowScene(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [hasSlot, cardKey]);

  return (
    <div
      ref={rootRef}
      className={clsx(
        "pointer-events-none absolute inset-0 z-[5] min-h-0 min-w-0 overflow-hidden rounded-[inherit]",
        className,
      )}
      aria-hidden
    >
      {showScene ? (
        <div className={innerClassName}>{children}</div>
      ) : (
        <div className="preparing-spline-page__scene preparing-spline-page__scene--static absolute inset-0" />
      )}
    </div>
  );
}
