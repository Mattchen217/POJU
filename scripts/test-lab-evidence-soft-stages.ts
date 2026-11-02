/**
 * Lab evidence_soft stages — TERMS-PIPELINE-SPEC-v1 acceptance chain.
 * Ensures Delivery Lab can dump live bare → mark → locale_polish → soft.
 *
 * Stage 3 is REAL LLM (mocked here — no network). zh must NOT silent-identity.
 * Skip path must show locale_polish as skipped, not pretend it ran.
 *
 * Uses closed-set terms already wired in autoMark (bazi 驿马/天德/月德).
 */
import assert from "node:assert/strict";
import {
  runEvidenceSoftCodePipeline,
  runEvidenceSoftGenerate,
  runEvidenceSoftMarkPipeline,
} from "@/lib/llm/pro/delivery/pipeline-v3/evidence-soft";
import {
  mockPolishMarkedEvidenceKeepMarkers,
  markersPreserved,
  type EvidenceLocalePolishLlm,
} from "@/lib/llm/pro/delivery/pipeline-v3/evidence-locale-polish";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const plan: DeepEvidencePlan = {
  page: "02",
  units: [
    {
      path: "why_cards[0]",
      chart_anchors: ["日柱"],
      evidence:
        "今天讨论驿马和天德贵人，还有月德，以及团队推进节奏。",
    },
  ],
};

const STAGE_KEYS = ["bare", "mark", "locale_polish", "soft"] as const;

function mockLocalePolishLlm(): EvidenceLocalePolishLlm {
  return async ({ user, locale }) => {
    // Pull marked evidence strings from the prompt JSON fence.
    const fence = user.match(/```json\s*([\s\S]*?)```/);
    assert.ok(fence, "mock LLM sees JSON fence");
    const payload = JSON.parse(fence![1]!) as {
      arguments: Array<{ evidence: string }>;
    };
    const polished = payload.arguments.map((a) => ({
      evidence: mockPolishMarkedEvidenceKeepMarkers(a.evidence, locale),
    }));
    for (let i = 0; i < payload.arguments.length; i++) {
      assert.ok(
        markersPreserved(payload.arguments[i]!.evidence, polished[i]!.evidence),
        "mock keeps ⟦t:⟧ markers",
      );
    }
    return {
      ok: true,
      content: JSON.stringify({ arguments: polished }),
      tokens_used: 42,
      result: {
        actual_model: "mock-locale-polish",
        meta: {
          call_type: "main_delivery",
          tokens_used: 42,
          latency_ms: 1,
          cost_usd: 0,
          cached_tokens: 0,
          thinking_enabled: false,
          thinking_effort: "low",
          prompt_tokens: 20,
          completion_tokens: 22,
          usage_written: false,
          finish_reason: "stop",
          generation_id: "mock-gen",
        },
      },
    };
  };
}

async function main() {
  // --- Sync mark helper still exposes bare/mark for Lab/unit inspect ---
  const markedOnly = runEvidenceSoftMarkPipeline({
    key: "02",
    plan,
    locale: "zh",
  });
  assert.match(
    markedOnly.mark["02"]?.[0]?.evidence ?? "",
    /⟦t:/,
    "mark pipeline adds glossary markers",
  );

  // Deprecated sync code pipeline: identity fallback still works for older callers
  const zhSync = runEvidenceSoftCodePipeline({
    key: "02",
    plan,
    locale: "zh",
  });
  for (const k of STAGE_KEYS) assert.ok(zhSync.stages[k], `sync stage ${k}`);
  assert.equal(
    zhSync.stages.locale_polish["02"]?.[0]?.evidence,
    zhSync.stages.mark["02"]?.[0]?.evidence,
    "sync helper may identity-fallback when polish not provided",
  );

  // --- REAL generate path with mock LLM (zh must change connective) ---
  const gen = await runEvidenceSoftGenerate({
    key: "02",
    plan,
    locale: "zh",
    locale_polish_llm: mockLocalePolishLlm(),
  });
  assert.equal(gen.ok, true, "generate ok");
  if (!gen.ok) throw new Error("unreachable");

  for (const k of STAGE_KEYS) assert.ok(gen.stages?.[k], `generate stage ${k}`);

  const bare0 = gen.stages.bare["02"]?.[0]?.evidence ?? "";
  const mark0 = gen.stages.mark["02"]?.[0]?.evidence ?? "";
  const polish0 = gen.stages.locale_polish["02"]?.[0]?.evidence ?? "";
  const soft0 = gen.stages.soft["02"]?.[0]?.evidence ?? "";

  assert.match(bare0, /驿马/, "bare keeps free traditional");
  assert.match(mark0, /⟦t:/, "mark adds glossary markers");
  assert.match(mark0, /yi_ma/, "mark has yi_ma id");
  assert.ok(markersPreserved(mark0, polish0), "polish preserves markers");
  assert.notEqual(
    polish0,
    mark0,
    "zh locale_polish is REAL polish — NOT silent identity of mark",
  );
  assert.ok(soft0.length > 0, "soft non-empty");
  assert.doesNotMatch(soft0, /⟦t:/, "soft is plain (no markers)");
  assert.doesNotMatch(soft0, /驿马/, "soft replaces 驿马");
  assert.match(soft0, /团队/, "soft keeps innocent prose");

  assert.equal(
    gen.locale_polish_meta.mode,
    "llm",
    "meta.mode=llm when polish runs",
  );
  assert.equal(gen.locale_polish_meta.tokens_used, 42, "polish tokens recorded");
  assert.equal(
    gen.locale_polish_meta.actual_model,
    "mock-locale-polish",
    "polish model on meta",
  );
  assert.equal(gen.tokens_used, 42, "tokens_used bubbles to generate result");

  const parsed = gen.call_trace.parsed as {
    pipeline?: string;
    stages?: unknown;
    stage_keys?: string[];
    locale_polish?: { mode?: string; tokens_used?: number; actual_model?: string };
  };
  assert.equal(parsed.pipeline, "terms-pipeline-spec-v1");
  assert.ok(parsed.stages, "call_trace.parsed.stages for Lab UI");
  assert.deepEqual(parsed.stage_keys, [...STAGE_KEYS]);
  assert.equal(parsed.locale_polish?.mode, "llm");
  assert.equal(parsed.locale_polish?.tokens_used, 42);
  assert.equal(parsed.locale_polish?.actual_model, "mock-locale-polish");
  assert.ok(
    gen.notes.some((n) => n.includes("locale_polish:llm")),
    "notes tag real LLM polish",
  );
  assert.ok(
    gen.notes.some((n) => n.includes("toSoftTranslatedPlainText")),
    "notes tag code soft",
  );

  // --- en with mock LLM ---
  const en = await runEvidenceSoftGenerate({
    key: "02",
    plan,
    locale: "en",
    locale_polish_llm: mockLocalePolishLlm(),
  });
  assert.equal(en.ok, true, "en generate ok");
  if (!en.ok) throw new Error("unreachable");
  const enMark = en.stages.mark["02"]?.[0]?.evidence ?? "";
  const enPolish = en.stages.locale_polish["02"]?.[0]?.evidence ?? "";
  const enSoft = en.stages.soft["02"]?.[0]?.evidence ?? "";
  assert.match(enMark, /⟦t:/, "en mark has markers");
  assert.notEqual(enPolish, enMark, "en polish differs from mark");
  assert.ok(enSoft.length > 0, "en soft non-empty");
  assert.doesNotMatch(enSoft, /驿马/, "en soft replaces 驿马");

  // --- explicit Skip: stage3 visible as skipped, not fake-ran ---
  const skipped = await runEvidenceSoftGenerate({
    key: "02",
    plan,
    locale: "zh",
    skip_locale_polish: true,
    locale_polish_llm: mockLocalePolishLlm(),
  });
  assert.equal(skipped.ok, true, "skip path ok");
  if (!skipped.ok) throw new Error("unreachable");
  for (const k of STAGE_KEYS) assert.ok(skipped.stages[k], `skip stage ${k}`);
  assert.equal(
    skipped.stages.locale_polish["02"]?.[0]?.evidence,
    skipped.stages.mark["02"]?.[0]?.evidence,
    "skip keeps mark text as polish payload",
  );
  assert.equal(skipped.locale_polish_meta.mode, "skipped");
  assert.equal(skipped.locale_polish_meta.tokens_used, 0);
  assert.ok(
    skipped.notes.some((n) => n.includes("locale_polish:skipped")),
    "notes tag skipped polish",
  );
  const skipParsed = skipped.call_trace.parsed as {
    locale_polish?: { mode?: string };
    stage_notes?: Record<string, string>;
  };
  assert.equal(skipParsed.locale_polish?.mode, "skipped");
  assert.match(
    String(skipParsed.stage_notes?.locale_polish ?? ""),
    /SKIPPED/i,
    "stage_notes mark polish skipped",
  );

  // --- Max production fragments: soft exit must not keep trad+soft / EN+ZH stacks ---
  {
    const { toSoftTranslatedPlainText } = await import(
      "@/lib/llm/sanitize/compliance-terms"
    );
    const stackSoftEn = toSoftTranslatedPlainText("命宫核心定位域", "en");
    assert.equal(
      stackSoftEn.includes("CoreIdentityField核心定位域"),
      false,
      `EN soft no mixed stack: ${stackSoftEn}`,
    );
    assert.equal(stackSoftEn.includes("核心定位域"), false, stackSoftEn);
    const mashSoft = toSoftTranslatedPlainText("金土耗元截伐锚元", "zh");
    // Plain soft mash without markers is outside mark path; ensure stack peels still hold:
    assert.equal(
      toSoftTranslatedPlainText("命宫核心定位域", "zh").includes("命宫核心定位域"),
      false,
    );
    void mashSoft;
  }

  // EN locale_polish must be REAL LLM (not table-swap-only identity of mark)
  assert.equal(en.locale_polish_meta.mode, "llm", "en polish mode llm");
  assert.ok(
    en.notes.some((n) => n.includes("locale_polish:llm")),
    "en notes tag real LLM polish",
  );

  // --- empty evidence still fails ---
  const empty = await runEvidenceSoftGenerate({
    key: "02",
    plan: {
      page: "02",
      units: [{ path: "x", chart_anchors: [], evidence: "  " }],
    },
    locale: "zh",
    locale_polish_llm: mockLocalePolishLlm(),
  });
  assert.equal(empty.ok, false, "empty evidence fails");

  console.log("PASS test-lab-evidence-soft-stages");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
