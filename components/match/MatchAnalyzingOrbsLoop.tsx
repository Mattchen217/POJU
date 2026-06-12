"use client";

import { useEffect, useState } from "react";

import { MatchOrbsSpline } from "@/components/match/MatchOrbsSpline";
import {
  MATCH_ORBS_LOOP_FADE_MS,
  MATCH_ORBS_LOOP_VISIBLE_MS,
} from "@/lib/match/match-orbs-loop-timing";

/** Analyzing wait — orbs visible 4s, slow fade out, repeat until analysis completes. */
export function MatchAnalyzingOrbsLoop() {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const schedule = (fn: () => void, ms: number) => {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const runVisiblePhase = () => {
      setOpacity(1);
      schedule(runFadeOutPhase, MATCH_ORBS_LOOP_VISIBLE_MS);
    };

    const runFadeOutPhase = () => {
      setOpacity(0);
      schedule(runVisiblePhase, MATCH_ORBS_LOOP_FADE_MS);
    };

    runVisiblePhase();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className="match-analyzing-orbs-loop"
      style={{
        opacity,
        transition: `opacity ${MATCH_ORBS_LOOP_FADE_MS}ms ease-in-out`,
      }}
      aria-hidden
    >
      <MatchOrbsSpline className="match-analyzing-orbs" webGLContext="preparing" />
    </div>
  );
}
