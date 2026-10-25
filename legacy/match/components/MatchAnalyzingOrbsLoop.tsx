"use client";

import { useEffect, useState } from "react";

import { MatchOrbsSpline } from "@/components/match/MatchOrbsSpline";
import {
  MATCH_ORBS_LOOP_HIDDEN_MS,
  MATCH_ORBS_LOOP_VISIBLE_MS,
} from "@/lib/match/match-orbs-loop-timing";

/** Analyzing wait — mount orbs 4s, unmount, remount (repeat until analysis completes). */
export function MatchAnalyzingOrbsLoop() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const schedule = (fn: () => void, ms: number) => {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const runVisiblePhase = () => {
      setMounted(true);
      schedule(runHiddenPhase, MATCH_ORBS_LOOP_VISIBLE_MS);
    };

    const runHiddenPhase = () => {
      setMounted(false);
      schedule(runVisiblePhase, MATCH_ORBS_LOOP_HIDDEN_MS);
    };

    runVisiblePhase();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="match-analyzing-orbs-loop" aria-hidden>
      {mounted ? (
        <MatchOrbsSpline
          className="match-analyzing-orbs"
          variant="analyzing"
          webGLContext="preparing"
        />
      ) : null}
    </div>
  );
}
