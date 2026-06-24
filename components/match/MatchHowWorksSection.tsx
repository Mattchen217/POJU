"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { DsFlowStepRow, type FlowStep } from "@/components/ds/marketing/DsFlowStepRow";
import { MatchOrbsSpline } from "@/components/match/MatchOrbsSpline";

type Props = {
  header: ReactNode;
  steps: FlowStep[];
};

/**
 * Match homepage — How Match works band.
 * Spline mounts only while the section is in view; unmounts on scroll-away to free WebGL.
 */
export function MatchHowWorksSection({ header, steps }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { rootMargin: "96px 0px", threshold: [0, 0.06, 0.12] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="match-how-works-section">
      {header}

      <div className="match-how-works-spline" aria-hidden={!inView}>
        {inView ? (
          <MatchOrbsSpline className="match-how-works-orbs" />
        ) : (
          <div className="match-how-works-spline__scene match-how-works-spline__scene--static" />
        )}
      </div>

      <div className="mt-9">
        <DsFlowStepRow steps={steps} accentRgb="244,114,182" />
      </div>
    </div>
  );
}
