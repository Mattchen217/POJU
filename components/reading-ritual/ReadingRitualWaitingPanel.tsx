"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { ReadingRitualGate } from "@/components/reading-ritual/ReadingRitualGate";
import {
  hasReadingRitualSeen,
  markReadingRitualSeen,
  type ReadingRitualProduct,
} from "@/lib/reading-ritual/reading-ritual-storage";

import "@/styles/reading-ritual.css";

export type ReadingRitualWaitingPanelProps = {
  product: ReadingRitualProduct;
  ready: boolean;
  onReleased: () => void;
};

/**
 * Value framing + ritual gate on the same screen as LLM generation (timing ②).
 * Skips entirely when the user has already completed the ritual for this product.
 */
export function ReadingRitualWaitingPanel({ product, ready, onReleased }: ReadingRitualWaitingPanelProps) {
  const t = useTranslations("reading_ritual");
  const skipGate = hasReadingRitualSeen(product);
  const releasedRef = useRef(false);

  useEffect(() => {
    if (releasedRef.current) return;
    if (!skipGate || !ready) return;
    releasedRef.current = true;
    onReleased();
  }, [skipGate, ready, onReleased]);

  if (skipGate) return null;

  const finish = () => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    markReadingRitualSeen(product);
    onReleased();
  };

  return (
    <div className="preparing-spline-page__overlay" role="region" aria-live="polite">
      <div className="reading-ritual-panel">
        <p className="reading-ritual-panel__value">{t(`value_frame.${product}`)}</p>
        <ReadingRitualGate product={product} ready={ready} onEnter={finish} onSkip={finish} />
      </div>
    </div>
  );
}
