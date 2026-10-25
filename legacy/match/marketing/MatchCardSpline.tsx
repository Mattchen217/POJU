"use client";

import { MatchSplineScene } from "@/components/match/MatchSplineScene";

/** Homepage Match product card — hero-proven zoom inside a pre-expanded shell (see product-hero.css). */
export function MatchCardSpline() {
  return <MatchSplineScene variant="card" pointerFollow={false} className="h-full w-full min-h-0 min-w-0" />;
}
