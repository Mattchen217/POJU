"use client";

import type { StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { DsFlowStepRow, type FlowStep } from "@/components/ds/marketing/DsFlowStepRow";
import {
  GLYPH_HOW_BURST_DURATION_MS,
  GLYPH_HOW_CARD_HOLD_MS,
} from "@/lib/glyph/glyph-how-works-timing";
import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { WindCardWithParticles, type WindCardParticleKey } from "@/components/oracle/wind-cards";

export type GlyphWindRevealCard = {
  particleKey: WindCardParticleKey;
  image: StaticImageData;
  imageAlt: string;
};

const GLYPH_BURST_SCENE = "/animations/BAOZHAscene.splinecode";

type Phase = "idle" | "burst" | "card";

function GlyphWindCardOnly({ card }: { card: GlyphWindRevealCard }) {
  return (
    <div className="glyph-how-explosion__card glyph-how-explosion__card--visible">
      <div className="glyph-how-explosion__card-art">
        <WindCardWithParticles
          src={card.image}
          alt={card.imageAlt}
          particleKey={card.particleKey}
          sizes="148px"
        />
      </div>
    </div>
  );
}

/**
 * How Glyph works — BAOZHA burst (hold → shrink → expand → vanish), then one wind card per cycle.
 * Step chips below advance once per full cycle (burst + card hold).
 */
export function GlyphHowWorksExplosion({
  windCards,
  steps,
}: {
  windCards: GlyphWindRevealCard[];
  steps: FlowStep[];
}) {
  const windCount = windCards.length;
  const stepCount = steps.length;
  const burstRef = useRef<HTMLDivElement>(null);
  const [splineReady, setSplineReady] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const replayBurst = useCallback(() => {
    const el = burstRef.current;
    if (!el) return;
    el.classList.remove("glyph-how-explosion__scene--burst");
    void el.offsetWidth;
    el.classList.add("glyph-how-explosion__scene--burst");
    setPhase("burst");
  }, []);

  useEffect(() => {
    if (!splineReady || windCount === 0) return;
    if (phase === "idle") replayBurst();
  }, [phase, replayBurst, splineReady, windCount]);

  useEffect(() => {
    if (phase !== "card" || windCount === 0) return;
    const id = window.setTimeout(() => {
      if (stepCount > 0) {
        setStepIndex((s) => (s + 1) % stepCount);
      }
      setCardIndex((i) => (i + 1) % windCount);
      replayBurst();
    }, GLYPH_HOW_CARD_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [phase, replayBurst, stepCount, windCount]);

  const handleBurstEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.animationName !== "glyphHowBurstOnce") return;
    setPhase("card");
  };

  if (windCount === 0) {
    return <DsFlowStepRow steps={steps} accentRgb="167,139,250" cycleMs={2000} />;
  }

  const card = windCards[cardIndex]!;

  return (
    <div>
      <div
        className="glyph-how-explosion"
        style={
          {
            ["--glyph-how-burst-duration" as string]: `${GLYPH_HOW_BURST_DURATION_MS}ms`,
            ["--glyph-how-card-in-duration" as string]: "380ms",
          } as CSSProperties
        }
      >
        <div className="glyph-how-explosion__stage">
          <div
            ref={burstRef}
            className="glyph-how-explosion__scene"
            onAnimationEnd={handleBurstEnd}
            aria-hidden={phase === "card"}
          >
            <SplineInteractiveScene
              scene={GLYPH_BURST_SCENE}
              initialZoom={0.44}
              pointerFollow={false}
              renderOnDemand={false}
              className="h-full w-full"
              onLoad={() => setSplineReady(true)}
            />
          </div>

          {phase === "card" ? <GlyphWindCardOnly key={cardIndex} card={card} /> : null}
        </div>
      </div>
      <DsFlowStepRow steps={steps} accentRgb="167,139,250" activeIndex={stepIndex} />
    </div>
  );
}
