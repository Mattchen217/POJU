"use client";

import { MatchAnalyzingOrbsLoop } from "@/components/match/MatchAnalyzingOrbsLoop";

type MatchAnalyzingLoaderProps = {
  step: number;
  steps: string[];
  hint: string;
  previewLine?: string | null;
};

export function MatchAnalyzingLoader({ step, steps, hint, previewLine }: MatchAnalyzingLoaderProps) {
  return (
    <>
      <MatchAnalyzingOrbsLoop />

      <div className="match-analyzing-inner">
        <p key={step} className="match-analyzing-step">
          {steps[step] ?? steps[0]}
        </p>

        {previewLine ? <p className="match-analyzing-preview">{previewLine}</p> : null}

        <p className="match-analyzing-hint">{hint}</p>
      </div>
    </>
  );
}
