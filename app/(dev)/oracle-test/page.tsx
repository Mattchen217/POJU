"use client";

import { useMemo, useState } from "react";
import { DrawSequence } from "@/components/oracle/DrawSequence";
import { FullReading } from "@/components/oracle/FullReading";
import {
  drawSignByLevel,
  drawSignByNumber,
  getLevelDistribution,
  validateSignsData,
} from "@/lib/oracle/drawSign";
import type { GlyphLevel, SignData, UserInput } from "@/types/oracle";

const MOCK_USER_INPUT: UserInput = {
  birthYear: 1990,
  birthMonth: 5,
  birthDay: 15,
  birthShichen: "mao",
  question: "Should I change my career path?",
};

export default function OracleTestPage() {
  const [forcedSign, setForcedSign] = useState<SignData | null>(null);
  const [showFullReading, setShowFullReading] = useState(false);

  const validation = useMemo(() => validateSignsData(), []);
  const distribution = useMemo(() => getLevelDistribution(), []);
  const totalSigns = useMemo(
    () => Object.values(distribution).reduce((a, b) => a + b, 0),
    [distribution],
  );
  const pct = (count: number) =>
    totalSigns === 0 ? "0" : ((count / totalSigns) * 100).toFixed(0);

  if (forcedSign && showFullReading) {
    return (
      <FullReading
        sign={forcedSign}
        userInput={MOCK_USER_INPUT}
        onAskAgain={() => {
          setForcedSign(null);
          setShowFullReading(false);
        }}
        onClose={() => {
          setForcedSign(null);
          setShowFullReading(false);
        }}
      />
    );
  }

  if (forcedSign) {
    return (
      <DrawSequence
        userInput={MOCK_USER_INPUT}
        forcedSign={forcedSign}
        onSaveCard={() => alert("Save card (test)")}
        onShareCard={() => alert("Share card (test)")}
        onFullReading={() => {
          setShowFullReading(true);
        }}
        onClose={() => setForcedSign(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <h1 className="mb-8 text-2xl">Glyph Test Page (dev)</h1>

      <section className="mb-12 rounded-lg bg-white/5 p-6">
        <h2 className="mb-4 text-lg">Data Validation</h2>
        {validation.valid ? (
          <p className="text-green-400">✓ All 100 signs valid</p>
        ) : (
          <div className="space-y-1 text-red-400">
            <p>✗ Validation errors:</p>
            <ul className="list-disc pl-6">
              {validation.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mb-12 rounded-lg bg-white/5 p-6">
        <h2 className="mb-4 text-lg">Level Distribution</h2>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(distribution).map(([level, count]) => (
            <div key={level} className="text-center">
              <div className="text-sm text-purple-300">{level}</div>
              <div className="text-3xl">{count}</div>
              <div className="text-xs text-white/40">{pct(count)}%</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg">Force Draw by Level</h2>
        <div className="grid grid-cols-5 gap-3">
          {(
            [
              "divine_tailwind",
              "fair_sky",
              "still_water",
              "crosswind",
              "eye_of_storm",
            ] as GlyphLevel[]
          ).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                try {
                  setForcedSign(drawSignByLevel(level));
                } catch (e) {
                  alert(`Error: ${(e as Error).message}`);
                }
              }}
              className="rounded-lg border border-purple-500/40 bg-purple-500/20 px-4 py-3 text-sm hover:bg-purple-500/40"
            >
              {level.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg">Force Draw by Sign Number</h2>
        <div className="grid grid-cols-10 gap-2">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => {
                try {
                  setForcedSign(drawSignByNumber(num));
                } catch {
                  alert(`Sign #${num} not found`);
                }
              }}
              className="rounded bg-white/5 py-2 text-xs hover:bg-white/15"
            >
              {num}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg">Real Random Draw</h2>
        <a
          href="/glyph/reading"
          className="inline-block rounded-full bg-purple-500 px-8 py-3 text-white hover:bg-purple-600"
        >
          Go to /glyph/reading (full flow)
        </a>
      </section>
    </div>
  );
}
