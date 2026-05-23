"use client";

import { GlyphCard } from "@/components/oracle/GlyphCard";
import type { SignData } from "@/types/oracle";

type Props = {
  glyph: SignData;
  /** Reserved for draw-page animation; reading page uses static front. */
  animated?: boolean;
};

export function GlyphCanvas({ glyph }: Props) {
  return (
    <div className="glyph-canvas">
      <GlyphCard sign={glyph} side="front" />
    </div>
  );
}
