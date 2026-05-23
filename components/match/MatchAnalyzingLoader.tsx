"use client";

type MatchAnalyzingLoaderProps = {
  step: number;
  steps: string[];
  hint: string;
};

export function MatchAnalyzingLoader({ step, steps, hint }: MatchAnalyzingLoaderProps) {
  return (
    <div className="match-analyzing-inner">
      <div className="match-analyzing-icons" aria-hidden>
        <div className="match-dual-circles">
          <div className="match-circle match-circle-a" />
          <div className="match-circle match-circle-b" />
        </div>
      </div>

      <p key={step} className="match-analyzing-step">
        {steps[step] ?? steps[0]}
      </p>

      <p className="match-analyzing-hint">{hint}</p>
    </div>
  );
}
