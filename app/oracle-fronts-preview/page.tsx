"use client";

import { GlyphBackImage } from "@/components/oracle/glyph-back/GlyphBackImage";
import { GlyphFront } from "@/components/oracle/glyph-front/GlyphFront";
import { mockSignForLevel, PREVIEW_LEVEL_ORDER } from "@/lib/oracle/mockSign";

export default function OracleFrontsPreviewPage() {
  return (
    <div className="min-h-screen bg-black px-4 py-12 text-white">
      <h1 className="mb-2 text-center font-verse text-2xl">Glyph card fronts & backs</h1>
      <p className="mb-10 text-center text-sm text-white/50">
        Preview only — ensure PNGs exist under <code className="text-white/70">public/oracle/wind-cards/</code>
      </p>

      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        {PREVIEW_LEVEL_ORDER.map((level, idx) => {
          const sign = mockSignForLevel(level, idx + 1);
          return (
            <section key={level} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-center text-sm uppercase tracking-[0.2em] text-purple-300">
                {level.replace(/_/g, " ")}
              </h2>
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="mb-3 text-center text-xs text-white/40">Back</p>
                  <GlyphBackImage level={level} />
                </div>
                <div>
                  <p className="mb-3 text-center text-xs text-white/40">Front</p>
                  <GlyphFront sign={sign} animate={false} />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
