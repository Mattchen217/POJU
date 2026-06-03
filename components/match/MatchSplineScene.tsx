"use client";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import {
  MATCH_SPLINE_ANALYZING_ZOOM,
  MATCH_SPLINE_CARD_ZOOM,
  MATCH_SPLINE_HERO_ZOOM,
  MATCH_SPLINE_SCENE,
} from "@/lib/match/match-spline-scene";
import { cn } from "@/lib/utils/classnames";

import "@/styles/spline-interactive.css";

type MatchSplineVariant = "card" | "hero" | "analyzing";

const ZOOM_BY_VARIANT: Record<MatchSplineVariant, number> = {
  card: MATCH_SPLINE_CARD_ZOOM,
  hero: MATCH_SPLINE_HERO_ZOOM,
  analyzing: MATCH_SPLINE_ANALYZING_ZOOM,
};

type MatchSplineSceneProps = {
  className?: string;
  variant?: MatchSplineVariant;
  initialZoom?: number;
  pointerFollow?: boolean;
};

/** Match particle field — shared across marketing card, hero, and LLM wait. */
export function MatchSplineScene({
  className,
  variant = "hero",
  initialZoom,
  pointerFollow,
}: MatchSplineSceneProps) {
  const zoom = initialZoom ?? ZOOM_BY_VARIANT[variant];
  const follow = pointerFollow ?? variant === "hero";

  return (
    <SplineInteractiveScene
      scene={MATCH_SPLINE_SCENE}
      className={cn("match-spline-scene", className)}
      initialZoom={zoom}
      pointerFollow={follow}
      webGLContext={variant === "analyzing" ? "preparing" : "marketing"}
    />
  );
}
