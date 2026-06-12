"use client";

import { GlyphCard } from "@/components/oracle/GlyphCard";
import type { SignData } from "@/types/oracle";

type Props = {
  glyph: SignData;
  /** Reserved for draw-page animation; reading page uses static front. */
  animated?: boolean;
  /** Delivery page: smaller card so report content is visible below. */
  compact?: boolean;
};

export function GlyphCanvas({ glyph, animated = false, compact = false }: Props) {
  return (
    <div className={compact ? "glyph-canvas glyph-canvas--delivery" : "glyph-canvas"}>
      <GlyphCard sign={glyph} side="front" compact={compact} animate={animated} />
    </div>
  );
}
