"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlyphBackImage } from "@/components/oracle/glyph-back/GlyphBackImage";
import { GlyphFront } from "@/components/oracle/glyph-front/GlyphFront";
import type { SignData } from "@/types/oracle";

interface GlyphCardProps {
  sign: SignData;
  side: "back" | "front";
  onCardClick?: () => void;
  onFlipComplete?: () => void;
  /** Smaller face layout for delivery / reading page. */
  compact?: boolean;
  animate?: boolean;
}

export function GlyphCard({
  sign,
  side,
  onCardClick,
  onFlipComplete,
  compact = false,
  animate = true,
}: GlyphCardProps) {
  const isFlipped = side === "front";

  return (
    <div
      className={`relative mx-auto w-full select-none ${compact ? "glyph-card--compact max-w-[240px]" : "max-w-[400px] cursor-pointer"}`}
      style={{ perspective: "2000px" }}
      onClick={onCardClick}
    >
      <motion.div
        className="relative aspect-[9/16] w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? -180 : 0 }}
        transition={{
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={() => {
          if (isFlipped && onFlipComplete) {
            onFlipComplete();
          }
        }}
      >
        <div
          className="absolute inset-0 h-full w-full"
          style={{ backfaceVisibility: "hidden" }}
        >
          <GlyphBackImage level={sign.level} animate={!isFlipped} />
        </div>

        <div
          className="absolute inset-0 h-full w-full"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <GlyphFront sign={sign} animate={animate && isFlipped} compact={compact} />
        </div>
      </motion.div>

      <FlipFlash active={isFlipped} />
    </div>
  );
}

function FlipFlash({ active }: { active: boolean }) {
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowFlash(false);
      return;
    }
    const show = setTimeout(() => setShowFlash(true), 400);
    const hide = setTimeout(() => setShowFlash(false), 600);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [active]);

  return (
    <AnimatePresence>
      {showFlash ? (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[24px] bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        />
      ) : null}
    </AnimatePresence>
  );
}
