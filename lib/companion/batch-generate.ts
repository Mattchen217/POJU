/**
 * Background fill: 1 invoke = 1–2 days (true pair JSON).
 * Never 30 days in one shot. Prior today_is fingerprints reduce clones.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
import type { LabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import type { ReasoningEffort } from "@/lib/llm/router";

import { generateCompanionDayPairCards } from "./companion-daily-service";
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
  /** Present when LLM path ran (Lab dump). */
  call_trace?: LabCallTrace;
  system?: string;
  user?: string;
  pair_gate_passed?: boolean;
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
 * Lab helper: selected day N → [N, N+1] when N+1 exists (always attempt both).
 */
export function labPairDayIndexes(dayIndex: number): number[] {
  const n = Math.max(0, Math.min(COMPANION_WINDOW_DAYS - 1, Math.floor(dayIndex)));
  if (n >= COMPANION_WINDOW_DAYS - 1) return [n];
  return [n, n + 1];
}

/**
 * Generate 1–2 consecutive days in **one** LLM invoke.
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
  closedHints?: import("./pregen-daily-anchors").DailyAnchorClosedHints | null;
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

  const feeds: Array<{ dayIndex: number; snapshot: AtmosEngineSnapshot }> = [];
  const missing: CompanionDaySlot[] = [];

  for (const dayIndex of indexes) {
    const snapshot = input.liuri_pack[dayIndex];
    const prev = input.days.find((d) => d.day_index === dayIndex);
    if (!snapshot) {
      missing.push({
        day_index: dayIndex,
        date_key: prev?.date_key ?? `missing-${dayIndex}`,
        cards: null,
        generated_at: null,
        error: "missing_liuri_snapshot",
      });
      continue;
    }
    feeds.push({ dayIndex, snapshot });
  }

  if (!feeds.length) {
    return {
      generated: missing,
      fingerprints: [],
      tokens_used: 0,
      cost_usd: 0,
      pair_gate_passed: false,
    };
  }

  const firstIndex = feeds[0]!.dayIndex;
  const priors = priorFingerprintsFromDays(
    input.days.map((d) => ({ day_index: d.day_index, cards: d.cards })),
    firstIndex,
  );

  const gen = await generateCompanionDayPairCards({
    brief,
    days: feeds,
    locale,
    sessionId: input.sessionId,
    thinking_effort: input.thinking_effort,
    priorFingerprints: priors,
    closedHints: input.closedHints,
  });

  const generated: CompanionDaySlot[] = [...missing];
  const fingerprints: string[] = [];
  const now = new Date().toISOString();

  if (!gen.pair_gate.passed) {
    // Keep draft cards for Lab dump; production fill must ignore slots with error.
    for (const dayRes of gen.days) {
      const snap = feeds.find((f) => f.dayIndex === dayRes.day_index)?.snapshot;
      const prev = input.days.find((d) => d.day_index === dayRes.day_index);
      generated.push({
        day_index: dayRes.day_index,
        date_key: prev?.date_key ?? snap?.asOf.baziDayDate ?? `day-${dayRes.day_index}`,
        cards: dayRes.cards,
        generated_at: null,
        meta: gen.meta,
        error: `day_gate:${gen.pair_gate.failed_rule ?? "fail"}`,
      });
    }
    return {
      generated,
      fingerprints,
      tokens_used: gen.meta.tokens_used,
      cost_usd: gen.meta.cost_usd,
      call_trace: gen.call_trace,
      system: gen.system,
      user: gen.user,
      pair_gate_passed: false,
    };
  }

  for (const dayRes of gen.days) {
    const snap = feeds.find((f) => f.dayIndex === dayRes.day_index)?.snapshot;
    const prev = input.days.find((d) => d.day_index === dayRes.day_index);
    fingerprints.push(fingerprintTodayIs(dayRes.cards));
    generated.push({
      day_index: dayRes.day_index,
      date_key: prev?.date_key ?? snap?.asOf.baziDayDate ?? `day-${dayRes.day_index}`,
      cards: dayRes.cards,
      generated_at: now,
      meta: gen.meta,
      error: null,
    });
  }

  return {
    generated,
    fingerprints,
    tokens_used: gen.meta.tokens_used,
    cost_usd: gen.meta.cost_usd,
    call_trace: gen.call_trace,
    system: gen.system,
    user: gen.user,
    pair_gate_passed: true,
  };
}
