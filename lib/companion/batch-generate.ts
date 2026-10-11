/**
 * Background fill: 1 invoke = 1 day (pair = two sequential invokes).
 * Never 30 days in one shot. Prior today_is fingerprints reduce clones.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
import type { ReasoningEffort } from "@/lib/llm/router";

import { generateCompanionDayCards } from "./companion-daily-service";
import { normalizeCompanionLocale } from "./locale-voice";
import {
  COMPANION_WINDOW_DAYS,
  type CompanionBrief,
  type CompanionDayCards,
} from "./types";

export type CompanionDaySlot = {
  day_index: number;
  date_key: string;
  cards: CompanionDayCards | null;
  generated_at?: string | null;
  meta?: {
    model?: string;
    tokens_used?: number;
    cost_usd?: number;
    latency_ms?: number;
  };
  error?: string | null;
};

export type GenerateCompanionPairResult = {
  generated: CompanionDaySlot[];
  /** Fingerprints written this pair (for next pair / gate). */
  fingerprints: string[];
  tokens_used: number;
  cost_usd: number;
};

function fingerprintTodayIs(cards: CompanionDayCards): string {
  return cards.today_is.replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Collect fingerprints from already-generated neighbor days (up to 2). */
export function priorFingerprintsFromDays(
  days: Array<{ day_index: number; cards: CompanionDayCards | null | undefined }>,
  beforeIndex: number,
): string[] {
  const out: string[] = [];
  for (let i = beforeIndex - 1; i >= 0 && out.length < 2; i--) {
    const cards = days.find((d) => d.day_index === i)?.cards;
    if (cards?.today_is?.trim()) out.push(fingerprintTodayIs(cards));
  }
  return out.reverse();
}

/** Next pending day indexes (no cards), up to `pairSize` (1 or 2). */
export function nextPendingDayIndexes(
  days: Array<{ day_index: number; cards: CompanionDayCards | null | undefined }>,
  pairSize: 1 | 2 = 2,
  startFrom = 0,
): number[] {
  const out: number[] = [];
  for (let i = startFrom; i < COMPANION_WINDOW_DAYS && out.length < pairSize; i++) {
    const slot = days.find((d) => d.day_index === i);
    if (!slot?.cards) out.push(i);
  }
  return out;
}

/**
 * Generate 1–2 consecutive pending days (one LLM invoke per day).
 */
export async function generateCompanionDayPair(input: {
  brief: CompanionBrief;
  liuri_pack: AtmosEngineSnapshot[];
  days: CompanionDaySlot[];
  /** Explicit indexes; default = next pending pair. */
  day_indexes?: number[];
  pair_size?: 1 | 2;
  locale: string;
  sessionId: string;
  thinking_effort?: ReasoningEffort;
}): Promise<GenerateCompanionPairResult> {
  const locale = normalizeCompanionLocale(input.locale);
  const brief: CompanionBrief = { ...input.brief, locale };
  const indexes =
    input.day_indexes?.length ?
      input.day_indexes.slice(0, 2)
    : nextPendingDayIndexes(input.days, input.pair_size ?? 2);

  if (!indexes.length) {
    return { generated: [], fingerprints: [], tokens_used: 0, cost_usd: 0 };
  }

  const working = input.days.map((d) => ({ ...d }));
  const generated: CompanionDaySlot[] = [];
  let tokens_used = 0;
  let cost_usd = 0;
  const fingerprints: string[] = [];

  for (const dayIndex of indexes) {
    const snapshot = input.liuri_pack[dayIndex];
    if (!snapshot) {
      const slot: CompanionDaySlot = {
        day_index: dayIndex,
        date_key:
          working.find((d) => d.day_index === dayIndex)?.date_key ??
          `missing-${dayIndex}`,
        cards: null,
        generated_at: null,
        error: "missing_liuri_snapshot",
      };
      generated.push(slot);
      continue;
    }

    const priors = [
      ...priorFingerprintsFromDays(working, dayIndex),
      ...fingerprints,
    ].slice(-2);

    const gen = await generateCompanionDayCards({
      brief,
      snapshot,
      dayIndex,
      locale,
      sessionId: input.sessionId,
      thinking_effort: input.thinking_effort,
      priorFingerprints: priors,
    });

    tokens_used += gen.meta.tokens_used;
    cost_usd += gen.meta.cost_usd;
    const fp = fingerprintTodayIs(gen.cards);
    fingerprints.push(fp);

    const prev = working.find((d) => d.day_index === dayIndex);
    const slot: CompanionDaySlot = {
      day_index: dayIndex,
      date_key: prev?.date_key ?? snapshot.asOf.baziDayDate,
      cards: gen.cards,
      generated_at: new Date().toISOString(),
      meta: gen.meta,
      error: null,
    };
    const wi = working.findIndex((d) => d.day_index === dayIndex);
    if (wi >= 0) working[wi] = slot;
    else working.push(slot);
    generated.push(slot);
  }

  return { generated, fingerprints, tokens_used, cost_usd };
}
