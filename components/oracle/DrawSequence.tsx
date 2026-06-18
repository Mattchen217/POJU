"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlyphCard } from "@/components/oracle/GlyphCard";
import { drawSign } from "@/lib/oracle/drawSign";
import type { SignData, UserInput } from "@/types/oracle";

import "@/styles/glyph-draw-sequence.css";

type SequenceStage = "drawing" | "card-back" | "flipping" | "card-front" | "reading";

interface DrawSequenceProps {
  userInput: UserInput;
  onFullReading: (sign: SignData) => void;
  onClose?: () => void;
  forcedSign?: SignData;
}

export function DrawSequence({
  userInput: _userInput,
  onFullReading,
  onClose,
  forcedSign,
}: DrawSequenceProps) {
  const t = useTranslations("glyph.draw_sequence");
  const tGlyph = useTranslations("glyph");
  const [stage, setStage] = useState<SequenceStage>("drawing");
  const [sign, setSign] = useState<SignData | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const drawnSign = forcedSign ?? drawSign();
      setSign(drawnSign);
      setDrawError(null);
      setStage("card-back");
    } catch (e) {
      setDrawError((e as Error).message);
      setSign(null);
    }
  }, [forcedSign]);

  const handleCardClick = useCallback(() => {
    if (stage === "card-back") {
      setStage("flipping");
      return;
    }
    if (stage === "card-front") {
      if (!sign) return;
      onFullReading(sign);
    }
  }, [onFullReading, sign, stage]);

  const handleFlipComplete = useCallback(() => {
    setStage("card-front");
  }, []);

  useEffect(() => {
    if (stage !== "flipping") return;
    // Fallback: some environments may miss framer-motion completion callbacks.
    const timer = window.setTimeout(() => {
      setStage("card-front");
    }, 950);
    return () => window.clearTimeout(timer);
  }, [stage]);

  if (drawError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0B0815] to-black px-6 text-center">
        <p className="mb-6 max-w-md text-white/80">{drawError}</p>
        <Link
          href="/glyph"
          className="rounded-full border border-white/20 px-6 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          {tGlyph("back_to_glyph")}
        </Link>
      </div>
    );
  }

  if (!sign) {
    return null;
  }

  return (
    <div className="glyph-draw-sequence">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="glyph-draw-sequence__close"
          aria-label={t("close")}
        >
          ✕
        </button>
      ) : null}

      <div className="glyph-draw-sequence__column">
        <div className="glyph-draw-sequence__card">
          <GlyphCard
            sign={sign}
            side={stage === "card-back" ? "back" : "front"}
            onCardClick={handleCardClick}
            onFlipComplete={handleFlipComplete}
            draw
          />
        </div>

        <div className="glyph-draw-sequence__hint">
          {stage === "card-back" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 2 }}
            >
              {t("tap_to_reveal")}
            </motion.p>
          ) : null}

          {stage === "flipping" ? (
            <p className="pointer-events-none select-none opacity-0" aria-hidden>
              {t("tap_for_reading")}
            </p>
          ) : null}

          {stage === "card-front" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {t("tap_for_reading")}
            </motion.p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
