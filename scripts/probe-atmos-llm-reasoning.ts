/**
 * Atmos LLM reasoning probe — engine JSON → coaching English.
 *
 * Offline (snapshot only):
 *   pnpm exec tsx scripts/probe-atmos-llm-reasoning.ts
 *
 * Live (requires OPENROUTER in .env.local):
 *   pnpm exec tsx scripts/probe-atmos-llm-reasoning.ts --live
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildAtmosEngineSnapshot,
  type AtmosEngineSnapshot,
} from "@/lib/atmos/build-atmos-engine-snapshot";
import type { ProfileStructured, ProfileStrength } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import { zonedLocalToUtc } from "@/lib/syncro/true-solar-time";

const ROOT = resolve(__dirname, "..");
const LIVE = process.argv.includes("--live");

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function makeProfile(
  four: { year: string; month: string; day: string; hour: string },
  opts?: {
    strength?: ProfileStrength;
    yong?: string;
    xi?: string[];
    ji?: string[];
    daYun?: DaYunEntry[];
  },
): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "",
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "",
    yong_shen: opts?.yong ?? "水",
    xi_shen: opts?.xi ?? ["水", "金"],
    ji_shen: opts?.ji ?? ["火"],
    strength: opts?.strength ?? "weak",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year),
      month: pillar(four.month),
      day: pillar(four.day),
      hour: pillar(four.hour),
    },
    da_yun: opts?.daYun ?? [
      { start_age: 1, start_year: 2010, ganzhi: "甲午" },
      { start_age: 11, start_year: 2020, ganzhi: "乙未" },
    ],
    data_availability: {
      pillars_detail: true,
      da_yun: true,
      bazi_enrichment: false,
    },
  };
}

const ATMOS_PROBE_SYSTEM = `You are POJU Atmos — a calm field-read coach, not a fortune teller.

RULES (hard):
1. Use ONLY facts in the JSON user message. Do not invent clashes, combines, or spirit stars.
2. Never output: disaster, doom, broke/bankrupt, car accident, "do not go out", "will lose money", 大吉, 大凶, 流日, 流月, 八字, Day Master, Yong Shen.
3. Map machine cues to coaching language:
   - High pressure / climateTone pressured → focus on expectation & emotion management; never "great day to push hard".
   - DayBranch_Clash → external pace may shift plans; stay flexible.
   - ask_help → good day to ask for help / clear communication.
   - movement → expect more travel or context-switching; plan buffers.
   - deep_work → favor focused writing / coding / study blocks.
4. If overrideRule.blockSprintNarrative is true, you MUST NOT frame the day as a breakthrough or sprint window — even if dayWeather is ease or ShenSha is supportive.
5. Output English only, exactly three sections with these headings:
### Field tone
### What to watch
### One move
Each section: 2–4 short sentences. Actionable. No markdown tables.`;

function buildUserPrompt(snapshot: AtmosEngineSnapshot): string {
  // Strip Han relation labels from LLM view — feed machine fields only.
  const lean = {
    asOf: snapshot.asOf,
    cycles: {
      dayun: snapshot.cycles.dayun?.ganzhi ?? null,
      dayunIndex: snapshot.cycles.dayunIndex,
      liunian: snapshot.cycles.liunian.ganzhi,
      liuyue: snapshot.cycles.liuyue.ganzhi,
      liuri: snapshot.cycles.liuri.ganzhi,
    },
    dayMaster: {
      strength: snapshot.dayMaster.strength,
      // elements only — no stem characters to LLM if we want cleaner compliance;
      // keep strength + help flags.
    },
    relationToDayMaster: {
      tenGod: snapshot.relationToDayMaster.tenGod,
      dayElementHelp: snapshot.relationToDayMaster.dayElementHelp,
      dayStemElement: snapshot.relationToDayMaster.dayStemElement,
      dayBranchElement: snapshot.relationToDayMaster.dayBranchElement,
    },
    energy: snapshot.energy,
    activatedShenSha: snapshot.activatedShenSha.map((s) => ({
      id: s.id,
      cueCode: s.cueCode,
    })),
    interactionIds: snapshot.interactions.map((r) => ({
      id: r.id,
      kind: r.kind,
      source: r.source,
      positions: r.positions,
      polarity: r.polarity,
    })),
    yongshenSource: snapshot.yongshenSource,
  };

  return `Engine snapshot (facts only). Interpret for today.

${JSON.stringify(lean, null, 2)}

Write the three sections now.`;
}

type ProbeVerdict = {
  hasRequiredHeadings: boolean;
  bannedHit: string | null;
  respectsOverride: boolean;
  citesEngineSignal: boolean;
  go: boolean;
  notes: string[];
};

function evaluateLlmText(text: string, snapshot: AtmosEngineSnapshot): ProbeVerdict {
  const notes: string[] = [];
  const hasRequiredHeadings =
    /###\s*Field tone/i.test(text) &&
    /###\s*What to watch/i.test(text) &&
    /###\s*One move/i.test(text);
  if (!hasRequiredHeadings) notes.push("missing required ### headings");

  const bannedPatterns: Array<[string, RegExp]> = [
    ["disaster/doom", /\b(disaster|doom|cursed|fatal)\b/i],
    ["money loss", /\b(lose money|go bankrupt|financial ruin)\b/i],
    ["don't go out", /\b(don'?t|do not)\s+(go out|leave (the )?house|drive)\b/i],
    ["jixiong", /大吉|大凶|流日|流月|八字/],
    ["day master", /\bday master\b|\byong shen\b/i],
  ];
  let bannedHit: string | null = null;
  for (const [label, re] of bannedPatterns) {
    if (re.test(text)) {
      bannedHit = label;
      break;
    }
  }
  if (bannedHit) notes.push(`banned language: ${bannedHit}`);

  const lower = text.toLowerCase();
  let respectsOverride = true;
  if (snapshot.energy.overrideRule.blockSprintNarrative) {
    const sprinty =
      /\b(sprint|breakthrough|all-green|perfect day|push hard|go big|crush it)\b/i.test(
        text,
      );
    if (sprinty) {
      respectsOverride = false;
      notes.push("override violated: sprint/breakthrough framing under pressured climate");
    }
  }

  const cueCodes = new Set(snapshot.energy.focusSignals.map((s) => s.cueCode));
  for (const s of snapshot.activatedShenSha) cueCodes.add(s.cueCode);

  const signalHints: Array<[string, RegExp]> = [
    ["DayBranch_Clash", /\b(plan|pace|flexib|shift|adjust|interrupt)/i],
    ["ask_help", /\b(ask|help|support|reach out|communicat)/i],
    ["movement", /\b(travel|move|transit|switch|buffer|on the go)/i],
    ["deep_work", /\b(focus|write|code|study|deep work|concentrate)/i],
    ["pressured", /\b(pressure|expectat|emotion|strain|heavy|manage)/i],
  ];

  let citesEngineSignal = false;
  if (snapshot.energy.climateTone === "pressured" && signalHints[4]![1].test(lower)) {
    citesEngineSignal = true;
  }
  for (const [code, re] of signalHints) {
    if (code === "pressured") continue;
    if (cueCodes.has(code) && re.test(text)) {
      citesEngineSignal = true;
      break;
    }
  }
  // Also accept explicit cue code mention
  for (const code of cueCodes) {
    if (text.includes(code)) citesEngineSignal = true;
  }
  if (
    snapshot.energy.focusSignals.some((s) => s.cueCode === "DayBranch_Clash") &&
    /\b(plan|pace|flexib|shift|adjust)/i.test(text)
  ) {
    citesEngineSignal = true;
  }
  if (!citesEngineSignal) {
    // Soft: climate/dayWeather words
    if (
      lower.includes(snapshot.energy.climateTone) ||
      lower.includes(snapshot.energy.dayWeather) ||
      /\b(field|energy|rhythm|pace)\b/i.test(text)
    ) {
      citesEngineSignal = true;
      notes.push("signal citation: soft (tone/weather/field language)");
    } else {
      notes.push("weak link to engine signals");
    }
  }

  const go =
    hasRequiredHeadings && bannedHit === null && respectsOverride && citesEngineSignal;

  return {
    hasRequiredHeadings,
    bannedHit,
    respectsOverride,
    citesEngineSignal,
    go,
    notes,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  console.log("\n=== Atmos LLM reasoning probe ===\n");

  const profile = makeProfile(
    { year: "甲子", month: "丙寅", day: "戊午", hour: "壬子" },
    { yong: "水", xi: ["水", "金"], ji: ["火"], strength: "weak" },
  );
  const asOf = zonedLocalToUtc(
    { year: 2026, month: 7, day: 24, hour: 10, minute: 0, second: 0 },
    "UTC",
  );
  const snapshot = buildAtmosEngineSnapshot({
    structured: profile,
    date: asOf,
    timezone: "UTC",
  });

  const outPath = resolve(ROOT, ".data/atmos-probe-snapshot.json");
  mkdirSync(resolve(ROOT, ".data"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Wrote snapshot → ${outPath}`);
  console.log(
    `cycles: dayun=${snapshot.cycles.dayun?.ganzhi} liunian=${snapshot.cycles.liunian.ganzhi} liuyue=${snapshot.cycles.liuyue.ganzhi} liuri=${snapshot.cycles.liuri.ganzhi}`,
  );
  console.log(
    `energy: climate=${snapshot.energy.climateTone} day=${snapshot.energy.dayWeather} blockSprint=${snapshot.energy.overrideRule.blockSprintNarrative}`,
  );
  console.log(
    `shensha: ${snapshot.activatedShenSha.map((s) => s.cueCode).join(", ") || "(none)"}`,
  );

  assert("engine snapshot builds", snapshot.schemaVersion === 1);
  assert(
    "fixture has pressured climate (good for override test)",
    snapshot.energy.climateTone === "pressured" ||
      snapshot.energy.overrideRule.blockSprintNarrative,
    snapshot.energy.climateTone,
  );

  if (!LIVE) {
    console.log("\nOffline mode — skip LLM. Re-run with --live when OpenRouter is configured.");
    console.log("Engine-only verdict: GO for Phase-1 local compute.\n");
    console.log(
      "Phase-2 LLM gate: pending (--live). Delivery design stays blocked until live probe GO.\n",
    );
    return;
  }

  const { isOpenRouterConfigured } = await import("@/lib/llm/openrouter-shared");
  const { callLLM } = await import("@/lib/llm/router");

  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER not configured — cannot run --live probe.");
    process.exitCode = 1;
    return;
  }

  const result = await callLLM({
    call_type: "matrix_narrative",
    system: ATMOS_PROBE_SYSTEM,
    messages: [{ role: "user", content: buildUserPrompt(snapshot) }],
    max_tokens: 2000,
    thinking_effort: "off",
    temperature: 0.4,
    session_id: `atmos-probe-${snapshot.asOf.baziDayDate}`,
    phase_name: "atmos_probe",
  });

  console.log("\n--- LLM output ---\n");
  console.log(result.content);
  console.log("\n--- meta ---");
  console.log(
    JSON.stringify(
      {
        model: result.actual_model,
        tokens: result.meta.tokens_used,
        cost_usd: result.meta.cost_usd,
        latency_ms: result.meta.latency_ms,
      },
      null,
      2,
    ),
  );

  const verdict = evaluateLlmText(result.content, snapshot);
  console.log("\n--- verdict ---");
  assert("required headings", verdict.hasRequiredHeadings);
  assert("no banned language", verdict.bannedHit === null, verdict.bannedHit ?? "");
  assert("respects overrideRule", verdict.respectsOverride);
  assert("cites engine signals", verdict.citesEngineSignal);
  for (const n of verdict.notes) console.log(`  note: ${n}`);

  if (verdict.go) {
    console.log("\n*** GO — local facts + model reasoning look usable. Next: delivery design. ***\n");
  } else {
    console.log(
      "\n*** NO-GO — fix engine fields / prompt guardrails before delivery design. ***\n",
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
