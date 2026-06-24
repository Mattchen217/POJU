"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { GlyphFront } from "@/components/oracle/glyph-front/GlyphFront";
import { generateFullReading } from "@/lib/oracle/api";
import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";
import {
  LEVEL_META,
  type SignData,
  type UserInput,
  type FullReading as FullReadingType,
} from "@/types/oracle";

const LOADING_MESSAGES = [
  "Reading your signal...",
  "Translating ancient wisdom...",
  "Understanding your question...",
  "Forming the response...",
] as const;

interface FullReadingProps {
  sign: SignData;
  userInput: UserInput;
  onReadingReady?: (reading: FullReadingType) => void;
  archiveSaveState?: "idle" | "saving" | "saved" | "failed";
}

export function FullReading({
  sign,
  userInput,
  onReadingReady,
  archiveSaveState = "idle",
}: FullReadingProps) {
  const locale = useLocale();
  const [reading, setReading] = useState<FullReadingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onReadingReadyRef = useRef(onReadingReady);
  onReadingReadyRef.current = onReadingReady;

  useEffect(() => {
    let canceled = false;

    async function fetchReading() {
      setLoading(true);
      setError(null);

      try {
        const result = await generateFullReading({
          sign,
          userInput,
          locale,
        });

        if (!canceled) {
          setReading(result);
          setLoading(false);
          if (!result.invalid_input) {
            onReadingReadyRef.current?.(result);
          }
        }
      } catch (err) {
        if (!canceled) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Something in the signal is unclear. Try again in a moment.";
          setError(errorMessage);
          setLoading(false);
        }
      }
    }

    void fetchReading();

    return () => {
      canceled = true;
    };
  }, [sign, userInput, locale]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-[#0B0815] to-black">
      <div className="mx-auto max-w-[860px] px-5 py-8 sm:px-6">
        <div className="mb-8">
          <div className="mx-auto w-full max-w-[280px]">
            <GlyphFront sign={sign} animate={false} compact />
          </div>
        </div>

        <h1 className="mb-8 text-center font-verse text-2xl text-white">
          Your Full Reading
        </h1>

        {loading ? <ReadingLoading /> : null}
        {error ? <ReadingError error={error} /> : null}
        {reading ? <ReadingContent reading={reading} sign={sign} /> : null}

        {reading && !reading.invalid_input ? (
          <ReadingFooter
            sign={sign}
            archiveSaveState={archiveSaveState}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReadingLoading() {
  const [messageIdx, setMessageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx((idx) => (idx + 1) % LOADING_MESSAGES.length);
    }, ACTIVITY_CAPTION_ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="py-16 text-center">
      <div className="mb-6 inline-block h-12 w-12">
        <motion.div
          className="h-full w-full rounded-full border-2 border-purple-500/30 border-t-purple-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={messageIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85 }}
          className="italic text-white/60"
        >
          {LOADING_MESSAGES[messageIdx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function ReadingError({ error }: { error: string }) {
  return (
    <div className="py-16 text-center">
      <p className="mb-4 text-white/80">{error}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-white/10 px-6 py-2 text-sm text-white hover:bg-white/20"
      >
        Try again
      </button>
    </div>
  );
}

function ReadingContent({
  reading,
  sign,
}: {
  reading: FullReadingType;
  sign: SignData;
}) {
  const meta = LEVEL_META[sign.level];

  if (reading.invalid_input) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-amber-300/20 bg-amber-200/[0.04] px-5 py-6 text-[15px] leading-8 text-white/90"
      >
        <p>{reading.wind_category_blurb}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-10 text-[16px] leading-8 text-white/90 sm:text-[17px] sm:leading-9"
    >
      <Section title="YOUR PATTERN" accentColor={meta.accent_color}>
        <p>{reading.wind_category_blurb}</p>
      </Section>

      <Section title="YOUR GLYPH" accentColor={meta.accent_color}>
        <p>{reading.classical_voice}</p>
        <p>{reading.meaning_for_question}</p>
        <p>{reading.hidden_tension}</p>
      </Section>

      <Section title="YOUR MOMENT" accentColor={meta.accent_color}>
        <p>{reading.your_moment}</p>
      </Section>

      <Section title="EXPLORATION" accentColor={meta.accent_color}>
        <p>{reading.exploration.text}</p>
        <p className="text-sm text-white/70">
          {reading.exploration.timeframe.replace("_", " ")} · {reading.exploration.duration_estimate} ·{" "}
          {reading.exploration.is_solo ? "solo" : "shared"}
        </p>
      </Section>

      <Section title="A REFLECTION" accentColor={meta.accent_color}>
        <p className="italic">{reading.reflection_question}</p>
      </Section>
    </motion.div>
  );
}

function Section({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-5 sm:px-5">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="h-[1px] w-8"
          style={{ backgroundColor: accentColor, opacity: 0.6 }}
        />
        <h3
          className="text-[11px] font-semibold tracking-[0.24em] sm:text-xs"
          style={{ color: accentColor }}
        >
          {title}
        </h3>
        <div
          className="h-[1px] flex-1"
          style={{ backgroundColor: accentColor, opacity: 0.3 }}
        />
      </div>
      <div className="space-y-5 leading-8 text-white/90">{children}</div>
    </div>
  );
}

function ReadingFooter({
  sign,
  archiveSaveState,
}: {
  sign: SignData;
  archiveSaveState: "idle" | "saving" | "saved" | "failed";
}) {
  const archiveStatusText =
    archiveSaveState === "saving"
      ? "Saving this reading to Archive..."
      : archiveSaveState === "saved"
        ? "✓ This reading is saved to your Archive. Return anytime."
        : archiveSaveState === "failed"
          ? "Could not save to Archive automatically. Please copy key notes or try Ask Again."
          : "Preparing auto-save to Archive...";
  const archiveStatusClass =
    archiveSaveState === "failed" ? "text-amber-300/90" : "text-white/50";

  return (
    <div className="mt-12 border-t border-white/10 pt-12">
      <div className="mb-12 rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-900/20 to-transparent px-6 py-8 text-center">
        <p className="mb-2 italic leading-relaxed text-white/90">Need to go deeper?</p>
        <p className="mb-6 text-sm leading-relaxed text-white/70">
          Bring this to POJU. One question. Unlimited depth. Until you see your way through.
          Just $9.99.
        </p>

        <a
          href={`/api/payment/checkout?source=oracle_hook&sign_id=${sign.sign_number}`}
          className="inline-block rounded-full bg-purple-500 px-8 py-3 font-medium tracking-wide text-white shadow-lg shadow-purple-500/30 transition-all hover:bg-purple-600"
        >
          Ask POJU · $9.99
        </a>
      </div>

      <p className={`mb-8 text-center text-sm italic ${archiveStatusClass}`}>
        {archiveStatusText}
      </p>

    </div>
  );
}
