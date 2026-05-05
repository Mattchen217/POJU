"use client";

import { HeroSpline } from "@/components/marketing/hero-spline";

/**
 * 首页「Three ways」Glyph 卡：BAOZHA；动效层相对卡片垂直居中（top 50% + translateY -50%）。
 */
export function ProductCardGlyphSpline() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] min-h-0 min-w-0 overflow-hidden rounded-[inherit] mix-blend-normal"
      aria-hidden
    >
      <div className="absolute inset-x-0 top-1/2 min-h-0 h-[108%] w-full -translate-y-1/2 [filter:brightness(1.22)_contrast(1.2)_saturate(1.12)]">
        <HeroSpline
          scene="/animations/BAOZHAscene.splinecode"
          initialZoom={0.42}
          className="h-full w-full min-h-0 min-w-0"
        />
      </div>
    </div>
  );
}
