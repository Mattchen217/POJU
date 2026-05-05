"use client";

import { HeroSpline } from "@/components/marketing/hero-spline";

/**
 * POJU 首页卡片：`inset-0` 裁剪；内层用 `top` 负值 + `h` 略大于 100% 整体上移，
 * 底边仍贴齐父级；整体不透明度 50%（约一半透明）。
 */
export function ProductCardPojuSpline() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] min-h-0 min-w-0 overflow-hidden rounded-[inherit] opacity-50"
      aria-hidden
    >
      <div className="absolute inset-x-0 top-[-5%] h-[105%] min-h-0 w-full">
        <HeroSpline
          scene="/animations/POJURENscene.splinecode"
          initialZoom={0.68}
          className="h-full w-full min-h-0 min-w-0"
        />
      </div>
    </div>
  );
}
