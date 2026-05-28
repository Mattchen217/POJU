"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

import {
  clearMarketingSplineVisibility,
  marketingSplineSlotGranted,
  marketingSplineStaggerMs,
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
 * Mounts heavy Spline only when the card is on-screen; staggers startup; limits
 * concurrent WebGL in narrow PWA to avoid iOS WKWebView OOM (see marketing-spline-slots).
 */
export function ProductCardSplineFrame({
  cardKey,
  className,
  innerClassName,
  children,
}: ProductCardSplineFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hasSlot, setHasSlot] = useState(false);
  const [mounted, setMounted] = useState(false);

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
        setMarketingSplineVisibility(cardKey, visible ? ratio : 0);
      },
      { rootMargin: "64px 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75] },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearMarketingSplineVisibility(cardKey);
    };
  }, [cardKey]);

  useEffect(() => {
    if (!inView) {
      setHasSlot(false);
      return;
    }
    const sync = () => setHasSlot(marketingSplineSlotGranted(cardKey));
    sync();
    return subscribeMarketingSplineSlots(sync);
  }, [inView, cardKey]);

  useEffect(() => {
    if (!hasSlot) {
      setMounted(false);
      return;
    }
    const delay = marketingSplineStaggerMs(cardKey);
    const timer = window.setTimeout(() => setMounted(true), delay);
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
      {mounted ? (
        <div className={innerClassName}>{children}</div>
      ) : (
        <div className="preparing-spline-page__scene preparing-spline-page__scene--static absolute inset-0" />
      )}
    </div>
  );
}
