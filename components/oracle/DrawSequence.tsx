"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlyphCard } from "@/components/oracle/GlyphCard";
import { drawSign } from "@/lib/oracle/drawSign";
import type { SignData, UserInput } from "@/types/oracle";

type SequenceStage = "drawing" | "card-back" | "flipping" | "card-front" | "reading";

interface DrawSequenceProps {
  userInput: UserInput;
  onSaveCard?: (sign: SignData) => void;
  onShareCard?: (sign: SignData) => void;
  onFullReading?: (sign: SignData) => void;
  onClose?: () => void;
  forcedSign?: SignData;
}

export function DrawSequence({
  userInput: _userInput,
  onSaveCard,
  onShareCard,
  onFullReading,
  onClose,
  forcedSign,
}: DrawSequenceProps) {
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
    }
  }, [stage]);

  const handleFlipComplete = useCallback(() => {
    setStage("card-front");
  }, []);

  if (drawError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0B0815] to-black px-6 text-center">
        <p className="mb-6 max-w-md text-white/80">{drawError}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/20 px-6 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Close
        </button>
      </div>
    );
  }

  if (!sign) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0B0815] to-black px-6 py-12">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/10 hover:text-white"
        aria-label="Close"
      >
        ✕
      </button>

      <div className="w-full max-w-[400px]">
        <GlyphCard
          sign={sign}
          side={stage === "card-back" ? "back" : "front"}
          onCardClick={handleCardClick}
          onFlipComplete={handleFlipComplete}
        />
      </div>

      <div className="mt-8 w-full max-w-[400px]">
        <AnimatePresence mode="wait">
          {stage === "card-back" ? (
            <motion.div
              key="back-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 1.5 }}
              className="flex justify-center gap-3"
            >
              <ActionButton icon="💾" label="Save" onClick={() => onSaveCard?.(sign)} />
              <ActionButton icon="⎋" label="Share" onClick={() => onShareCard?.(sign)} />
              <ActionButton
                icon="👁"
                label="View Front"
                primary
                onClick={() => setStage("flipping")}
              />
            </motion.div>
          ) : null}

          {stage === "card-front" ? (
            <motion.div
              key="front-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="flex justify-center gap-3"
            >
              <ActionButton icon="💾" label="Save" onClick={() => onSaveCard?.(sign)} />
              <ActionButton icon="⎋" label="Share" onClick={() => onShareCard?.(sign)} />
              <ActionButton
                icon="📖"
                label="Full Reading"
                primary
                onClick={() => onFullReading?.(sign)}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {stage === "card-back" ? (
        <motion.p
          className="absolute bottom-12 text-sm tracking-wider text-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2 }}
        >
          Tap card to reveal
        </motion.p>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  primary = false,
  onClick,
}: {
  icon: string;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium tracking-wide transition-all duration-200 ${
        primary
          ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30 hover:bg-purple-600"
          : "border border-white/20 bg-white/10 text-white/90 backdrop-blur-md hover:bg-white/20"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
