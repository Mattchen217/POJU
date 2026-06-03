"use client";

import { MatchSplineScene } from "@/components/match/MatchSplineScene";

type MatchAnalyzingLoaderProps = {
  step: number;
  steps: string[];
  hint: string;
  previewLine?: string | null;
};

export function MatchAnalyzingLoader({ step, steps, hint, previewLine }: MatchAnalyzingLoaderProps) {
  return (
    <div className="match-analyzing-inner">
      <div className="match-analyzing-spline" aria-hidden>
        <MatchSplineScene variant="analyzing" className="match-analyzing-spline__scene" pointerFollow={false} />
      </div>

      <p key={step} className="match-analyzing-step">
        {steps[step] ?? steps[0]}
      </p>

      {previewLine ? (
        <p className="match-analyzing-preview">{previewLine}</p>
      ) : null}

      <p className="match-analyzing-hint">{hint}</p>
    </div>
  );
}
