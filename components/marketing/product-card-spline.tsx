"use client";

import { HeroSpline } from "@/components/marketing/hero-spline";
import { ProductCardSplineFrame } from "@/components/marketing/ProductCardSplineFrame";

/** Replace with your Match card `.splinecode` path when the asset is uploaded. */
export const MATCH_CARD_SPLINE_SCENE = "/animations/XYscene.splinecode";

type CardSplineConfig = {
  scene: string;
  initialZoom: number;
  frameClassName?: string;
  innerClassName: string;
  pointerFollow?: boolean;
};

const CARD_SPLINES: Partial<Record<string, CardSplineConfig>> = {
  poju: {
    scene: "/animations/POJURENscene.splinecode",
    initialZoom: 0.68,
    frameClassName: "opacity-50",
    innerClassName: "absolute inset-x-0 top-[-5%] h-[105%] min-h-0 w-full",
  },
  glyph: {
    scene: "/animations/BAOZHAscene.splinecode",
    initialZoom: 0.42,
    innerClassName:
      "absolute inset-x-0 top-1/2 min-h-0 h-[108%] w-full -translate-y-1/2 [filter:brightness(1.22)_contrast(1.2)_saturate(1.12)]",
  },
  syncro: {
    scene: "/animations/FWscene.splinecode",
    initialZoom: 0.48,
    innerClassName:
      "absolute inset-x-0 top-1/2 min-h-0 h-[108%] w-full -translate-y-1/2 [filter:brightness(1.22)_contrast(1.2)_saturate(1.12)]",
  },
  match: {
    scene: MATCH_CARD_SPLINE_SCENE,
    initialZoom: 0.55,
    innerClassName:
      "absolute inset-x-0 top-1/2 min-h-0 h-[108%] w-full -translate-y-1/2 [filter:brightness(1.18)_contrast(1.15)_saturate(1.1)]",
  },
};

type ProductCardSplineProps = {
  kind: string;
};

/** Homepage product card Spline — lazy viewport mount; supports poju / glyph / syncro / match. */
export function ProductCardSpline({ kind }: ProductCardSplineProps) {
  const cfg = CARD_SPLINES[kind];
  if (!cfg) return null;

  return (
    <ProductCardSplineFrame cardKey={kind} className={cfg.frameClassName} innerClassName={cfg.innerClassName}>
      <HeroSpline
        scene={cfg.scene}
        initialZoom={cfg.initialZoom}
        pointerFollow={cfg.pointerFollow ?? false}
        className="h-full w-full min-h-0 min-w-0"
      />
    </ProductCardSplineFrame>
  );
}
