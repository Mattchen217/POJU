"use client";

import { useIsPwaMode } from "@/components/pwa/PWAConditional";
import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import {
  MATCH_SPLINE_ANALYZING_ZOOM,
  MATCH_SPLINE_ANALYZING_DISPLAY_SCALE,
  MATCH_SPLINE_CARD_DISPLAY_SCALE,
  MATCH_SPLINE_CARD_ZOOM,
  MATCH_SPLINE_HERO_DISPLAY_SCALE,
  MATCH_SPLINE_HERO_PWA_DISPLAY_SCALE,
  MATCH_SPLINE_HERO_PWA_ZOOM,
  MATCH_SPLINE_HERO_ZOOM,
  MATCH_SPLINE_SCENE,
} from "@/lib/match/match-spline-scene";
import { cn } from "@/lib/utils/classnames";
import type { CSSProperties } from "react";

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

const DISPLAY_SCALE_BY_VARIANT: Partial<Record<MatchSplineVariant, number>> = {
  card: MATCH_SPLINE_CARD_DISPLAY_SCALE,
  hero: MATCH_SPLINE_HERO_DISPLAY_SCALE,
  analyzing: MATCH_SPLINE_ANALYZING_DISPLAY_SCALE,
};

/** Match particle field — shared across marketing card, hero, and LLM wait. */
export function MatchSplineScene({
  className,
  variant = "hero",
  initialZoom,
  pointerFollow,
}: MatchSplineSceneProps) {
  const isPwa = useIsPwaMode();
  const heroPwa = variant === "hero" && isPwa === true;
  const zoom =
    initialZoom ??
    (heroPwa ? MATCH_SPLINE_HERO_PWA_ZOOM : ZOOM_BY_VARIANT[variant]);
  const follow = pointerFollow ?? variant === "hero";
  const displayScale =
    heroPwa && variant === "hero"
      ? MATCH_SPLINE_HERO_PWA_DISPLAY_SCALE
      : DISPLAY_SCALE_BY_VARIANT[variant];

  return (
    <SplineInteractiveScene
      scene={MATCH_SPLINE_SCENE}
      className={cn(
        "match-spline-scene",
        variant === "hero" && "match-spline-scene--hero",
        variant === "card" && "match-spline-scene--card",
        className,
      )}
      style={
        displayScale != null && displayScale !== 1
          ? ({ ["--match-spline-display-scale" as string]: String(displayScale) } as CSSProperties)
          : undefined
      }
      initialZoom={zoom}
      pointerFollow={follow}
      webGLContext={variant === "analyzing" ? "preparing" : "marketing"}
    />
  );
}
