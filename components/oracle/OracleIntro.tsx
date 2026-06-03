"use client";

import { LEVEL_META, type GlyphLevel } from "@/types/oracle";

const LEVEL_ORDER: GlyphLevel[] = [
  "divine_tailwind",
  "fair_sky",
  "still_water",
  "crosswind",
  "eye_of_storm",
];

interface OracleIntroProps {
  onStart: () => void;
}

export function OracleIntro({ onStart }: OracleIntroProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0B0815] to-black px-6 py-16 text-white">
      <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.35em] text-purple-300/80">
          POJU Glyph
        </p>
        <h1 className="font-verse mb-6 text-3xl leading-tight md:text-4xl">
          One question. One glyph.
        </h1>
        <p className="mb-10 text-base italic leading-relaxed text-white/70">
          Read with a wink. One pattern, one perspective.
        </p>

        <div className="mb-12 grid grid-cols-5 gap-2 text-[10px] uppercase tracking-wider text-white/50 md:text-xs">
          {LEVEL_ORDER.map((level) => (
            <div key={level} className="flex flex-col items-center gap-1">
              <span
                className="text-lg"
                style={{ color: LEVEL_META[level].primary_color }}
                aria-hidden
              >
                {level === "eye_of_storm" ? "◉" : "✦"}
              </span>
              <span className="hidden text-center md:block">
                {LEVEL_META[level].display_name.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>

        <section className="mb-12 border-t border-white/10 pt-10 text-left">
          <h2 className="mb-4 text-center font-verse text-lg text-purple-200">
            On the glyphs
          </h2>
          <p className="text-sm leading-relaxed text-white/65">
            Each glyph is a lens: color, symbol, and verse work together as one mirror. There are
            no good glyphs and no bad glyphs—only honest reflections of this moment and your
            question.
          </p>
        </section>

        <div className="mb-10 space-y-3 text-sm text-white/80">
          <p>One question.</p>
          <p>Honest question.</p>
          <p>60 characters.</p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mx-auto rounded-full bg-purple-500 px-10 py-4 font-medium tracking-wide text-white shadow-lg shadow-purple-500/30 transition-all hover:bg-purple-600"
        >
          Start Your Glyph
        </button>

        <p className="mt-10 text-center text-xs text-white/40">
          Read with a wink. The patterns mirror what&apos;s happening — they offer reflection and insight. Decisions are yours alone.
        </p>
      </div>
    </div>
  );
}
