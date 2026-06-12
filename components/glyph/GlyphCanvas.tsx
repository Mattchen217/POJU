"use client";

import type { CSSProperties } from "react";
import crosswindFront from "@/assets/images/crosswind front.png";
import divineTailwindFront from "@/assets/images/divine tailwind front.png";
import eyeOfStormFront from "@/assets/images/eye of storm front.png";
import fairSkyFront from "@/assets/images/fair sky front.png";
import stillWaterFront from "@/assets/images/still water front.png";
import type { SignData } from "@/types/oracle";

const FRONT_BY_LEVEL = {
  divine_tailwind: divineTailwindFront,
  fair_sky: fairSkyFront,
  still_water: stillWaterFront,
  crosswind: crosswindFront,
  eye_of_storm: eyeOfStormFront,
} satisfies Record<SignData["level"], typeof eyeOfStormFront>;

type Props = {
  glyph: SignData;
  /** Reserved for draw-page animation; reading page uses static front. */
  animated?: boolean;
};

export function GlyphCanvas({ glyph }: Props) {
  const front = FRONT_BY_LEVEL[glyph.level];
  const verse =
    glyph.summary_line_en?.trim() ||
    glyph.verse_lines_en.filter(Boolean).join(" ") ||
    "—";

  return (
    <div className="glyph-canvas">
      <div
        className="glyph-card-front"
        style={
          {
            "--glyph-front-src": `url(${front.src})`,
          } as CSSProperties
        }
      >
        <p className="gf-verse">&ldquo;{verse}&rdquo;</p>
        <div className="gf-sigil" aria-hidden>
          ✦
        </div>
        <div className="gf-domain">pojulife.com</div>
      </div>
    </div>
  );
}
